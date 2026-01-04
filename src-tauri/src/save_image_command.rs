use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::path::Path;

/// Saves a base64-encoded image to the specified folder.
/// Creates the assets/images directory if it doesn't exist.
/// Returns the relative path to the saved image for use in Markdown.
#[tauri::command]
pub fn save_image_from_clipboard(
    base64_data: String,
    folder_path: String,
    filename: String,
) -> Result<String, String> {
    // Decode base64 data
    let image_data = general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Failed to decode base64 image: {}", e))?;

    // Create assets/images directory
    let assets_path = Path::new(&folder_path).join("assets").join("images");
    fs::create_dir_all(&assets_path)
        .map_err(|e| format!("Failed to create assets/images directory: {}", e))?;

    // Save the image file
    let image_path = assets_path.join(&filename);
    fs::write(&image_path, image_data)
        .map_err(|e| format!("Failed to write image file: {}", e))?;

    // Return relative path for Markdown
    let relative_path = format!("assets/images/{}", filename);
    Ok(relative_path)
}
