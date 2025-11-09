using HueGraphics.Application.Interfaces;
using HueGraphics.Core.Interfaces;
using HueGraphics.Domain.Settings;
using HueGraphics.Infrastructure.Services;
using HueGraphics.Infrastructure.HostedServices;
using Serilog;

// Configure Serilog
var logPath = Path.Combine(AppContext.BaseDirectory, "logs", "huegraphics-.log");
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .MinimumLevel.Override("Microsoft.AspNetCore", Serilog.Events.LogEventLevel.Warning)
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.File(logPath,
        rollingInterval: RollingInterval.Day,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .CreateLogger();

try
{
    Log.Information("Starting HueGraphics API");

    var builder = WebApplication.CreateBuilder(args);

    // Use Serilog for logging
    builder.Host.UseSerilog();

    // Add services to the container
    builder.Services.AddControllers();
    builder.Services.AddEndpointsApiExplorer();

    // Configure form options for large file uploads
    builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
    {
        options.MultipartBodyLengthLimit = 104857600; // 100 MB
        options.ValueLengthLimit = 104857600; // 100 MB
        options.MultipartHeadersLengthLimit = 104857600; // 100 MB
    });

    // Configure Kestrel for large request bodies
    builder.WebHost.ConfigureKestrel(options =>
    {
        options.Limits.MaxRequestBodySize = 104857600; // 100 MB
    });
    builder.Services.AddSwaggerGen(c =>
    {
        c.SwaggerDoc("v1", new() { Title = "HueGraphics API", Version = "v1" });
    });

    // Configure settings
    builder.Services.Configure<PointCloudSettings>(
        builder.Configuration.GetSection("PointCloudSettings"));
    builder.Services.Configure<UploadSettings>(
        builder.Configuration.GetSection("UploadSettings"));
    builder.Services.Configure<ModelParserSettings>(
        builder.Configuration.GetSection("ModelParserSettings"));

    // Register services
    builder.Services.AddScoped<IPointCloudService, PointCloudService>();
    builder.Services.AddScoped<IModelUploadService, ModelUploadService>();
    builder.Services.AddScoped<ICleanupService, CleanupService>();
    builder.Services.AddSingleton<IBackgroundProcessingService, BackgroundProcessingService>();

    // Register hosted services (background tasks)
    builder.Services.AddHostedService<CleanupBackgroundService>();

    // Add CORS
    builder.Services.AddCors(options =>
    {
        options.AddPolicy("AllowClient", policy =>
        {
            policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
    });

    var app = builder.Build();

    // Configure the HTTP request pipeline
    if (app.Environment.IsDevelopment())
    {
        app.UseSwagger();
        app.UseSwaggerUI();
    }

    // Use Serilog request logging
    app.UseSerilogRequestLogging();

    app.UseCors("AllowClient");

    app.UseAuthorization();

    app.MapControllers();

    Log.Information("HueGraphics API started successfully");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
