# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

# Copy solution and project files
COPY ["backend/HueGraphics.API/HueGraphics.API.csproj", "HueGraphics.API/"]
COPY ["backend/HueGraphics.Application/HueGraphics.Application.csproj", "HueGraphics.Application/"]
COPY ["backend/HueGraphics.Domain/HueGraphics.Domain.csproj", "HueGraphics.Domain/"]
COPY ["backend/HueGraphics.Core/HueGraphics.Core.csproj", "HueGraphics.Core/"]
COPY ["backend/HueGraphics.Infrastructure/HueGraphics.Infrastructure.csproj", "HueGraphics.Infrastructure/"]

# Restore dependencies
RUN dotnet restore "HueGraphics.API/HueGraphics.API.csproj"

# Copy remaining backend source code
COPY backend/ .

# Build the application
WORKDIR "/src/HueGraphics.API"
RUN dotnet build "HueGraphics.API.csproj" -c Release -o /app/build

# Publish stage
FROM build AS publish
RUN dotnet publish "HueGraphics.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final

# Install Rust and model_parser dependencies
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

# Copy published application
COPY --from=publish /app/publish .

# Copy and build model_parser
COPY model_parser /model_parser
WORKDIR /model_parser
RUN cargo build --release

# Move compiled binary to app directory
RUN mv /model_parser/target/release/model_parser /app/model_parser

WORKDIR /app

# Create directory for point cloud data
RUN mkdir -p /app/pointcloud-data

# Expose port
EXPOSE 5000

# Set environment variables
ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production

# Start the application
ENTRYPOINT ["dotnet", "HueGraphics.API.dll"]
