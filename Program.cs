using System.IdentityModel.Tokens.Jwt;
using System.IO.Compression;
using System.Net;
using System.Text.Json.Serialization;
using System.Threading.Channels;
using Api.Data;
using Api.Middleware;
using Api.Models;
using Api.Repositories;
using Api.Services;
using Api.Services.Audio;
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
    SingleReader = false,
    SingleWriter = false,
}));
builder.Services.AddSingleton<IEventLog, EventLogService>();
builder.Services.AddSingleton<ConcurrencyTracker>();
builder.Services.AddSingleton<SlowQueryInterceptor>();
builder.Services.AddScoped<DiagnosticAnalyzer>();

builder.Services.AddHostedService<EventLogWorker>();

var defaultConnectionString = ResolvePostgresConnectionString(
    builder.Configuration.GetConnectionString("DefaultConnection")
    ?? builder.Configuration["DATABASE_URL"],
    "DefaultConnection");

builder.Services.AddDbContext<AppDbContext>((sp, options) =>
{
    options.UseNpgsql(
        defaultConnectionString,
        // Auto-retry transient Postgres / pgbouncer hiccups (e.g. "Exception while reading
        // from stream" when the pooler drops an idle connection). Safe because no code path
        // uses explicit BeginTransaction; if you add one, wrap it in CreateExecutionStrategy.
        npg => npg.EnableRetryOnFailure(
            maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(2),
            errorCodesToAdd: null));
    options.AddInterceptors(sp.GetRequiredService<SlowQueryInterceptor>());
});

builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IWeekRepository, WeekRepository>();
builder.Services.AddScoped<IWordSetRepository, WordSetRepository>();
builder.Services.AddScoped<IWordRepository, WordRepository>();
builder.Services.AddScoped<IProgressRepository, ProgressRepository>();
builder.Services.AddScoped<IFriendshipRepository, FriendshipRepository>();

builder.Services.AddHttpClient();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<WeekService>();
builder.Services.AddScoped<WordSetService>();
builder.Services.AddScoped<WordService>();
builder.Services.AddScoped<VocabService>();
builder.Services.AddScoped<ProgressService>();
builder.Services.AddScoped<StatsService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<FriendshipService>();
builder.Services.AddScoped<UserProfileService>();
builder.Services.AddScoped<DictionaryService>();
builder.Services.Configure<AzureSpeechOptions>(builder.Configuration.GetSection("Azure:Speech"));
builder.Services.AddSingleton<ITtsService, AzureTtsService>();
builder.Services.AddSingleton<IAudioStorage, SupabaseAudioStorage>();
builder.Services.AddScoped<AiService>();
builder.Services.AddScoped<ReadingTextService>();
builder.Services.AddScoped<TagService>();

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
        .VaryByValue(ctx => new KeyValuePair<string, string>(
            "uid",
            ctx.User.FindFirst("sub")?.Value ?? ""))
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
    // Migrations require a session-mode connection: pg_advisory_lock is session-scoped
    // and prepared statements (used internally by EF Migrate) break on PgBouncer
    // transaction-mode (port 6543). Prefer MigrationConnection (port 5432 session pooler);
    // fall back to DefaultConnection if not configured.
    var migrationConnString = ResolvePostgresConnectionString(
        builder.Configuration.GetConnectionString("MigrationConnection")
        ?? builder.Configuration["MIGRATION_DATABASE_URL"]
        ?? defaultConnectionString,
        "MigrationConnection");

    var migrationOptions = new DbContextOptionsBuilder<AppDbContext>()
        .UseNpgsql(migrationConnString, npg => npg.EnableRetryOnFailure(
            maxRetryCount: 3,
            maxRetryDelay: TimeSpan.FromSeconds(2),
            errorCodesToAdd: null))
        .Options;

    await using var migrationDb = new AppDbContext(migrationOptions);
    var conn = migrationDb.Database.GetDbConnection();
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
            await migrationDb.Database.MigrateAsync();
            await SeedData.SeedAsync(migrationDb);
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

static string ResolvePostgresConnectionString(string? configured, string name)
{
    if (string.IsNullOrWhiteSpace(configured))
    {
        throw new InvalidOperationException(
            $"{name} missing. Set ConnectionStrings__DefaultConnection or DATABASE_URL.");
    }

    if (!Uri.TryCreate(configured, UriKind.Absolute, out var uri) ||
        (uri.Scheme != "postgres" && uri.Scheme != "postgresql"))
    {
        return configured;
    }

    var credentials = uri.UserInfo.Split(':', 2);
    var user = credentials.Length > 0 ? WebUtility.UrlDecode(credentials[0]) : "";
    var password = credentials.Length > 1 ? WebUtility.UrlDecode(credentials[1]) : "";
    var database = uri.AbsolutePath.TrimStart('/');
    var query = ParseConnectionQuery(uri.Query);
    var sslMode = query.TryGetValue("sslmode", out var configuredSslMode)
        ? configuredSslMode
        : "Prefer";

    return string.Join(';', new[]
    {
        $"Host={uri.Host}",
        $"Port={(uri.Port > 0 ? uri.Port : 5432)}",
        $"Database={WebUtility.UrlDecode(database)}",
        $"Username={user}",
        $"Password={password}",
        $"SSL Mode={sslMode}",
        "Trust Server Certificate=true",
        "Pooling=true"
    });
}

static Dictionary<string, string> ParseConnectionQuery(string query)
{
    var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    if (string.IsNullOrWhiteSpace(query)) return values;

    foreach (var part in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
    {
        var pair = part.Split('=', 2);
        var key = WebUtility.UrlDecode(pair[0]);
        if (string.IsNullOrWhiteSpace(key)) continue;
        values[key] = pair.Length > 1 ? WebUtility.UrlDecode(pair[1]) : "";
    }

    return values;
}
