using HueGraphics.Application.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace HueGraphics.Infrastructure.HostedServices;

public class CleanupBackgroundService : BackgroundService
{
    private readonly ILogger<CleanupBackgroundService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private readonly TimeSpan _cleanupInterval = TimeSpan.FromHours(1);

    public CleanupBackgroundService(
        ILogger<CleanupBackgroundService> logger,
        IServiceProvider serviceProvider)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Cleanup Background Service is starting");

        // Wait 5 minutes before first cleanup (let the app start up)
        await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                _logger.LogInformation("Running scheduled cleanup task");

                // Create a scope to get scoped services
                using (var scope = _serviceProvider.CreateScope())
                {
                    var cleanupService = scope.ServiceProvider.GetRequiredService<ICleanupService>();
                    await cleanupService.PerformCleanupAsync(stoppingToken);
                }

                _logger.LogInformation("Cleanup task completed, next run in {Interval}", _cleanupInterval);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred during cleanup task");
            }

            // Wait for the next cleanup interval
            await Task.Delay(_cleanupInterval, stoppingToken);
        }

        _logger.LogInformation("Cleanup Background Service is stopping");
    }

    public override async Task StopAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Cleanup Background Service is stopping");
        await base.StopAsync(stoppingToken);
    }
}
