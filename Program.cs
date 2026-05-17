using System.IdentityModel.Tokens.Jwt;
using System.IO.Compression;
using System.Text.Json.Serialization;
using System.Threading.Channels;
using Api.Data;
using Api.Middleware;
using Api.Models;
using Api.Repositories;
using Api.Services;
using Api.Services.Logging;
using Api.Utils;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.OutputCaching;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.ResponseCompression;
using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

// Disable JWT claim type mapping so we get raw 'sub', 'email', etc.
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();

var builder = WebApplication.CreateBuilder(args);

// Railway / production port binding
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
{
    builder.WebHost.ConfigureKestrel(o => o.ListenAnyIP(int.Parse(port)));
}

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});

builder.Services.AddOpenApi();
var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "http://localhost:3000")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddMemoryCache();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CurrentUserAccessor>();

// Logging pipeline
builder.Services.AddSingleton(_ => Channel.CreateBounded<EventLog>(new BoundedChannelOptions(10_000)
{
    FullMode = BoundedChannelFullMode.DropOldest,
    SingleReader = true,
    SingleWriter = false,
}));
builder.Services.AddSingleton<IEventLog, EventLogService>();
builder.Services.AddSingleton<ConcurrencyTracker>();
builder.Services.AddSingleton<SlowQueryInterceptor>();
builder.Services.AddScoped<DiagnosticAnalyzer>();
builder.Services.AddHostedService<EventLogWorker>();

builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"));
    options.AddInterceptors(sp.GetRequiredService<SlowQueryInterceptor>());
});

builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IWeekRepository, WeekRepository>();
builder.Services.AddScoped<IWordSetRepository, WordSetRepository>();
builder.Services.AddScoped<IWordRepository, WordRepository>();
builder.Services.AddScoped<IProgressRepository, ProgressRepository>();

builder.Services.AddHttpClient();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<WeekService>();
builder.Services.AddScoped<WordSetService>();
builder.Services.AddScoped<WordService>();
builder.Services.AddScoped<VocabService>();
builder.Services.AddScoped<ProgressService>();
builder.Services.AddScoped<StatsService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<DictionaryService>();
builder.Services.AddScoped<AiService>();
builder.Services.AddScoped<ReadingTextService>();

var projectRef = builder.Configuration["Supabase:ProjectRef"]
    ?? throw new InvalidOperationException("Supabase:ProjectRef missing");
var jwksUrl = $"https://{projectRef}.supabase.co/auth/v1/.well-known/jwks.json";

var jwksManager = new ConfigurationManager<OpenIdConnectConfiguration>(
    jwksUrl,
    new JwksRetriever(),
    new HttpDocumentRetriever { RequireHttps = true });

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.ConfigurationManager = jwksManager;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddResponseCompression(opts =>
{
    opts.EnableForHttps = true;
    opts.Providers.Add<BrotliCompressionProvider>();
    opts.Providers.Add<GzipCompressionProvider>();
    opts.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(new[] { "application/json" });
});
builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);

builder.Services.AddRateLimiter(opts =>
{
    opts.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
    {
        var key = ctx.User.FindFirst("sub")?.Value
            ?? ctx.Connection.RemoteIpAddress?.ToString()
            ?? "anon";
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 120,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        });
    });

    opts.AddPolicy("ai", ctx =>
    {
        var key = ctx.User.FindFirst("sub")?.Value
            ?? ctx.Connection.RemoteIpAddress?.ToString()
            ?? "anon";
        return RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 20,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        });
    });

    opts.OnRejected = async (context, ct) =>
    {
        var events = context.HttpContext.RequestServices.GetRequiredService<IEventLog>();
        var sub = context.HttpContext.User.FindFirst("sub")?.Value;
        Guid? uid = Guid.TryParse(sub, out var g) ? g : null;
        events.Write(
            EventLogLevel.Warning,
            "ratelimit.exceeded",
            "Rate limit hit",
            traceId: context.HttpContext.TraceIdentifier,
            userId: uid,
            endpoint: context.HttpContext.Request.Path,
            httpMethod: context.HttpContext.Request.Method,
            statusCode: 429,
            source: "RateLimiter");
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retry))
        {
            context.HttpContext.Response.Headers["Retry-After"] = ((int)retry.TotalSeconds).ToString();
        }
        await context.HttpContext.Response.WriteAsync("Rate limit exceeded", ct);
    };
});

builder.Services.AddOutputCache(opts =>
{
    opts.AddBasePolicy(b => b.NoCache());
    opts.AddPolicy("PerUser", b => b
        .SetVaryByHeader("Authorization")
        .Expire(TimeSpan.FromSeconds(30)));
    opts.AddPolicy("Public60", b => b.Expire(TimeSpan.FromSeconds(60)));
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
app.UseResponseCompression();
app.UseCors();
app.UseOutputCache();

if (!string.Equals(Environment.GetEnvironmentVariable("SKIP_MIGRATIONS"), "true", StringComparison.OrdinalIgnoreCase))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var conn = db.Database.GetDbConnection();
    await conn.OpenAsync();
    try
    {
        // Advisory lock so concurrent replicas don't race on Migrate/Seed.
        await using (var lockCmd = conn.CreateCommand())
        {
            lockCmd.CommandText = "SELECT pg_advisory_lock(727274001)";
            await lockCmd.ExecuteNonQueryAsync();
        }
        try
        {
            await db.Database.MigrateAsync();
            await SeedData.SeedAsync(db);
        }
        finally
        {
            await using var unlockCmd = conn.CreateCommand();
            unlockCmd.CommandText = "SELECT pg_advisory_unlock(727274001)";
            await unlockCmd.ExecuteNonQueryAsync();
        }
    }
    finally
    {
        await conn.CloseAsync();
    }
}

app.UseMiddleware<RequestLoggingMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<UserSyncMiddleware>();
app.UseRateLimiter();
app.MapControllers();

app.Run();
