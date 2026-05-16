using System.Text.Json.Serialization;
using Api.Data;
using Api.Middleware;
using Api.Repositories;
using Api.Services;
using Api.Utils;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

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

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

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
builder.Services.AddScoped<DictionaryService>();
builder.Services.AddScoped<AiService>();

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

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
app.UseCors();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
    await SeedData.SeedAsync(db);
}

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<UserSyncMiddleware>();
app.MapControllers();

app.Run();
