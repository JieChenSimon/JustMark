use reqwest_dav::{Auth, ClientBuilder, Depth, list_cmd::ListEntity};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WebDAVConfig {
    url: String,
    username: String,
    password: String,
    folder: String,
}

#[derive(Debug, Serialize)]
pub struct FileInfo {
    name: String,
    path: String,
    is_directory: bool,
}

#[tauri::command]
pub async fn webdav_test_connection(config: WebDAVConfig) -> Result<String, String> {
    let url = config.url.trim_end_matches('/');
    let folder = if config.folder.is_empty() || config.folder == "/" {
        "/".to_string()
    } else {
        config.folder.trim_end_matches('/').to_string()
    };

    let client = ClientBuilder::new()
        .set_host(url.to_string())
        .set_auth(Auth::Basic(config.username.clone(), config.password.clone()))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    client.list(&folder, Depth::Number(0))
        .await
        .map_err(|e| format!("Connection failed: {}. Check if URL '{}{}' is correct.", e, url, folder))?;

    Ok("Connected successfully".to_string())
}

#[tauri::command]
pub async fn webdav_list_files(config: WebDAVConfig) -> Result<Vec<FileInfo>, String> {
    let client = ClientBuilder::new()
        .set_host(config.url.clone())
        .set_auth(Auth::Basic(config.username, config.password))
        .build()
        .map_err(|e| e.to_string())?;

    let list = client.list(&config.folder, Depth::Number(1))
        .await
        .map_err(|e| e.to_string())?;

    let files: Vec<FileInfo> = list.into_iter()
        .filter_map(|entity| {
            if let ListEntity::File(file) = entity {
                Some(FileInfo {
                    name: file.href.split('/').last().unwrap_or("").to_string(),
                    path: file.href.clone(),
                    is_directory: false,
                })
            } else if let ListEntity::Folder(folder) = entity {
                Some(FileInfo {
                    name: folder.href.split('/').filter(|s| !s.is_empty()).last().unwrap_or("").to_string(),
                    path: folder.href.clone(),
                    is_directory: true,
                })
            } else {
                None
            }
        })
        .collect();

    Ok(files)
}

#[tauri::command]
pub async fn webdav_upload_file(config: WebDAVConfig, remote_path: String, content: String) -> Result<String, String> {
    let url = config.url.trim_end_matches('/');

    let client = ClientBuilder::new()
        .set_host(url.to_string())
        .set_auth(Auth::Basic(config.username, config.password))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    client.put(&remote_path, content.into_bytes())
        .await
        .map_err(|e| format!("Upload failed: {}", e))?;

    Ok("Uploaded successfully".to_string())
}

#[tauri::command]
pub async fn webdav_download_file(config: WebDAVConfig, remote_path: String) -> Result<String, String> {
    let url = config.url.trim_end_matches('/');

    let client = ClientBuilder::new()
        .set_host(url.to_string())
        .set_auth(Auth::Basic(config.username, config.password))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let response = client.get(&remote_path)
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    response.text().await
        .map_err(|e| format!("Failed to read response: {}", e))
}

#[tauri::command]
pub async fn webdav_create_directory(config: WebDAVConfig, remote_path: String) -> Result<String, String> {
    let url = config.url.trim_end_matches('/');

    let client = ClientBuilder::new()
        .set_host(url.to_string())
        .set_auth(Auth::Basic(config.username, config.password))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    client.mkcol(&remote_path)
        .await
        .map_err(|e| format!("Create directory failed: {}", e))?;

    Ok("Directory created".to_string())
}
