use reqwest_dav::{Auth, ClientBuilder, Depth, list_cmd::ListEntity};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WebDAVConfig {
    url: String,
    username: String,
    password: String,
    folder: String,
}

fn parse_url(url: &str) -> (String, String) {
    let trimmed = url.trim_end_matches('/');
    if let Some(pos) = trimmed.find("://") {
        if let Some(path_start) = trimmed[pos+3..].find('/') {
            let host = &trimmed[..pos+3+path_start];
            let base_path = &trimmed[pos+3+path_start..];
            return (host.to_string(), base_path.to_string());
        }
    }
    (trimmed.to_string(), String::new())
}

fn build_path(base_path: &str, folder: &str) -> String {
    let folder = folder.trim_matches('/');
    if folder.is_empty() {
        if base_path.is_empty() { "/" } else { base_path }.to_string()
    } else if base_path.is_empty() {
        format!("/{}", folder)
    } else {
        format!("{}/{}", base_path, folder)
    }
}

#[derive(Debug, Serialize)]
pub struct FileInfo {
    name: String,
    path: String,
    is_directory: bool,
    size: Option<i64>,
    last_modified: Option<String>,
    etag: Option<String>,
}

#[tauri::command]
pub async fn webdav_test_connection(config: WebDAVConfig) -> Result<String, String> {
    let (host, base_path) = parse_url(&config.url);

    let client = ClientBuilder::new()
        .set_host(host.clone())
        .set_auth(Auth::Basic(config.username.clone(), config.password.clone()))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    // Test 1: Try base_path only
    match client.list(&base_path, Depth::Number(0)).await {
        Ok(_) => eprintln!("[OK] Base path works: {}", base_path),
        Err(e) => eprintln!("[FAIL] Base path failed: {} - {}", base_path, e),
    }

    // Test 2: Try with folder
    let path = build_path(&base_path, &config.folder);
    match client.list(&path, Depth::Number(0)).await {
        Ok(_) => return Ok(format!("Connected successfully to {}", path)),
        Err(e) => eprintln!("[FAIL] Full path failed: {} - {}", path, e),
    }

    Err(format!("Cannot access {}. Check if the folder exists.", path))
}

#[tauri::command]
pub async fn webdav_list_files(config: WebDAVConfig) -> Result<Vec<FileInfo>, String> {
    let (host, base_path) = parse_url(&config.url);
    let path = build_path(&base_path, &config.folder);

    eprintln!("[LIST] url: {}", config.url);
    eprintln!("[LIST] folder: {}", config.folder);
    eprintln!("[LIST] host: {}", host);
    eprintln!("[LIST] base_path: {}", base_path);
    eprintln!("[LIST] final path: {}", path);

    let client = ClientBuilder::new()
        .set_host(host.clone())
        .set_auth(Auth::Basic(config.username, config.password))
        .build()
        .map_err(|e| e.to_string())?;

    let list = client.list(&path, Depth::Number(1))
        .await
        .map_err(|e| format!("List failed: {}. Requesting: {}{}", e, host, path))?;

    let files: Vec<FileInfo> = list.into_iter()
        .filter_map(|entity| {
            let strip_base = |href: &str| -> String {
                if !base_path.is_empty() && href.starts_with(&base_path) {
                    href[base_path.len()..].to_string()
                } else {
                    href.to_string()
                }
            };

            if let ListEntity::File(file) = entity {
                Some(FileInfo {
                    name: file.href.split('/').last().unwrap_or("").to_string(),
                    path: strip_base(&file.href),
                    is_directory: false,
                    size: Some(file.content_length),
                    last_modified: Some(file.last_modified.to_rfc3339()),
                    etag: file.tag.clone(),
                })
            } else if let ListEntity::Folder(folder) = entity {
                Some(FileInfo {
                    name: folder.href.split('/').filter(|s| !s.is_empty()).last().unwrap_or("").to_string(),
                    path: strip_base(&folder.href),
                    is_directory: true,
                    size: None,
                    last_modified: Some(folder.last_modified.to_rfc3339()),
                    etag: folder.tag.clone(),
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
    let (host, base_path) = parse_url(&config.url);
    let full_path = build_path(&base_path, &remote_path);

    let client = ClientBuilder::new()
        .set_host(host)
        .set_auth(Auth::Basic(config.username, config.password))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    client.put(&full_path, content.into_bytes())
        .await
        .map_err(|e| format!("Upload failed: {}", e))?;

    Ok("Uploaded successfully".to_string())
}

#[tauri::command]
pub async fn webdav_download_file(config: WebDAVConfig, remote_path: String) -> Result<String, String> {
    let (host, base_path) = parse_url(&config.url);
    let full_path = build_path(&base_path, &remote_path);

    let client = ClientBuilder::new()
        .set_host(host)
        .set_auth(Auth::Basic(config.username, config.password))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    let response = client.get(&full_path)
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    response.text().await
        .map_err(|e| format!("Failed to read response: {}", e))
}

#[tauri::command]
pub async fn webdav_create_directory(config: WebDAVConfig, remote_path: String) -> Result<String, String> {
    let (host, base_path) = parse_url(&config.url);
    let full_path = build_path(&base_path, &remote_path);

    let client = ClientBuilder::new()
        .set_host(host)
        .set_auth(Auth::Basic(config.username, config.password))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    client.mkcol(&full_path)
        .await
        .map_err(|e| format!("Create directory failed: {}", e))?;

    Ok("Directory created".to_string())
}

#[tauri::command]
pub async fn webdav_delete_file(config: WebDAVConfig, remote_path: String) -> Result<String, String> {
    let (host, _) = parse_url(&config.url);

    let client = ClientBuilder::new()
        .set_host(host)
        .set_auth(Auth::Basic(config.username, config.password))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    client.delete(&remote_path)
        .await
        .map_err(|e| format!("Delete failed: {}", e))?;

    Ok("Deleted successfully".to_string())
}
