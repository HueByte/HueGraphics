use clap::Parser;
use model_parser::{ModelParser, PointCloudConfig, SamplingStrategy, EptBuilder};
use std::path::PathBuf;

#[derive(Parser, Debug)]
#[command(name = "model_parser")]
#[command(about = "Convert 3D models to point cloud data for visualization", long_about = None)]
struct Args {
    /// Input 3D model file (GLTF/GLB)
    #[arg(short, long)]
    input: PathBuf,

    /// Output file or directory
    #[arg(short, long)]
    output: PathBuf,

    /// Output format: json or ept
    #[arg(short, long, default_value = "json")]
    format: String,

    /// Number of points to generate
    #[arg(short = 'n', long, default_value_t = 2000)]
    point_count: usize,

    /// Sampling strategy: uniform, area-weighted, or vertices
    #[arg(short, long, default_value = "area-weighted")]
    strategy: String,

    /// Include vertex normals
    #[arg(long, default_value_t = true)]
    normals: bool,

    /// Include vertex colors
    #[arg(long, default_value_t = true)]
    colors: bool,

    /// Scale factor for the model
    #[arg(long, default_value_t = 1.0)]
    scale: f32,

    /// Jitter amount (0.0-1.0)
    #[arg(short, long, default_value_t = 0.0)]
    jitter: f32,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    // Validate input file
    if !args.input.exists() {
        eprintln!("Error: Input file does not exist: {:?}", args.input);
        std::process::exit(1);
    }

    // Parse sampling strategy
    let strategy = match args.strategy.to_lowercase().as_str() {
        "uniform" => SamplingStrategy::Uniform,
        "area-weighted" | "area_weighted" => SamplingStrategy::AreaWeighted,
        "vertices" => SamplingStrategy::Vertices,
        _ => {
            eprintln!(
                "Error: Invalid sampling strategy '{}'. Use: uniform, area-weighted, or vertices",
                args.strategy
            );
            std::process::exit(1);
        }
    };

    // Create configuration
    let config = PointCloudConfig::new(args.point_count)
        .with_strategy(strategy)
        .with_normals(args.normals)
        .with_colors(args.colors)
        .with_scale(args.scale)
        .with_jitter(args.jitter);

    println!("Parsing 3D model: {:?}", args.input);
    println!("Configuration:");
    println!("  - Point count: {}", config.point_count);
    println!("  - Strategy: {:?}", config.sampling_strategy);
    println!("  - Include normals: {}", config.include_normals);
    println!("  - Include colors: {}", config.include_colors);
    println!("  - Scale: {}", config.scale);
    println!("  - Jitter: {}", config.jitter);

    // Parse the model
    let point_cloud = ModelParser::parse_file(&args.input, &config)?;

    println!("\nPoint cloud generated:");
    println!("  - Total points: {}", point_cloud.metadata.point_count);
    println!("  - Bounds min: {:?}", point_cloud.metadata.bounds_min);
    println!("  - Bounds max: {:?}", point_cloud.metadata.bounds_max);
    println!("  - Has normals: {}", point_cloud.metadata.has_normals);
    println!("  - Has colors: {}", point_cloud.metadata.has_colors);

    // Save based on format
    match args.format.to_lowercase().as_str() {
        "json" => {
            println!("\nSaving to JSON: {:?}", args.output);
            point_cloud.save_to_file(&args.output)?;
            println!("✓ Point cloud saved successfully!");
        }
        "ept" => {
            println!("\nBuilding EPT structure: {:?}", args.output);
            let ept_builder = EptBuilder::new();
            ept_builder.build(&point_cloud, &args.output)?;
            println!("✓ EPT structure created successfully!");
            println!("\nEPT files created:");
            println!("  - ept.json (metadata)");
            println!("  - ept-data/ (binary tiles)");
            println!("  - ept-hierarchy/ (octree structure)");
        }
        _ => {
            eprintln!("Error: Invalid format '{}'. Use: json or ept", args.format);
            std::process::exit(1);
        }
    }

    Ok(())
}
