use reqwest::Url;
use reqwest_dav::{Auth, ClientBuilder, Depth, list_cmd::ListEntity};
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Serialize, Deserialize)]
pub struct WebDAVConfig {
    url: String,
    username: String,
    password: String,
    folder: String,
}

const WEBDAV_KEYCHAIN_SERVICE: &str = "justmark-webdav";

fn normalize_remote_path(path: &str) -> Result<String, String> {
    let mut segments = Vec::new();

    for segment in path.split('/') {
        match segment {
            "" | "." => continue,
            ".." => return Err("Path traversal is not allowed.".to_string()),
            _ => segments.push(segment),
        }
    }

    if segments.is_empty() {
        Ok("/".to_string())
    } else {
        Ok(format!("/{}", segments.join("/")))
    }
}

fn parse_url(url: &str) -> Result<(String, String), String> {
    let parsed = Url::parse(url.trim()).map_err(|e| format!("Invalid WebDAV URL: {}", e))?;

    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("WebDAV URL must start with http:// or https://".to_string());
    }

    if parsed.query().is_some() || parsed.fragment().is_some() {
        return Err("WebDAV URL must not include query strings or fragments.".to_string());
    }

    let host = match parsed.host_str() {
        Some(hostname) => match parsed.port() {
            Some(port) => format!("{}://{}:{}", parsed.scheme(), hostname, port),
            None => format!("{}://{}", parsed.scheme(), hostname),
        },
        None => return Err("WebDAV URL is missing a host.".to_string()),
    };

    let normalized_path = normalize_remote_path(parsed.path())?;
    let base_path = if normalized_path == "/" {
        String::new()
    } else {
        normalized_path
    };

    Ok((host, base_path))
}

fn build_path(base_path: &str, folder: &str) -> Result<String, String> {
    let folder = normalize_remote_path(folder)?;

    if base_path.is_empty() {
        Ok(folder)
    } else if folder == "/" {
        Ok(base_path.to_string())
    } else {
        Ok(format!("{}{}", base_path, folder))
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

#[cfg(target_os = "macos")]
fn run_security(args: &[&str]) -> Result<String, String> {
    let output = Command::new("security")
        .args(args)
        .output()
        .map_err(|e| format!("Failed to invoke macOS security tool: {}", e))?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

#[cfg(target_os = "macos")]
fn security_item_exists(account: &str) -> bool {
    Command::new("security")
        .args([
            "find-generic-password",
            "-a",
            account,
            "-s",
            WEBDAV_KEYCHAIN_SERVICE,
            "-w",
        ])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

#[cfg(not(target_os = "macos"))]
fn unsupported_secure_storage() -> String {
    "Secure WebDAV password storage is currently only implemented on macOS.".to_string()
}

#[tauri::command]
pub fn webdav_save_password(credential_id: String, password: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        run_security(&[
            "add-generic-password",
            "-U",
            "-a",
            credential_id.as_str(),
            "-s",
            WEBDAV_KEYCHAIN_SERVICE,
            "-w",
            password.as_str(),
        ])?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = credential_id;
        let _ = password;
        Err(unsupported_secure_storage())
    }
}

#[tauri::command]
pub fn webdav_get_password(credential_id: String) -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        if !security_item_exists(&credential_id) {
            return Ok(None);
        }

        let password = run_security(&[
            "find-generic-password",
            "-a",
            credential_id.as_str(),
            "-s",
            WEBDAV_KEYCHAIN_SERVICE,
            "-w",
        ])?;
        return Ok(Some(password));
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = credential_id;
        Err(unsupported_secure_storage())
    }
}

#[tauri::command]
pub fn webdav_delete_password(credential_id: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if !security_item_exists(&credential_id) {
            return Ok(());
        }

        run_security(&[
            "delete-generic-password",
            "-a",
            credential_id.as_str(),
            "-s",
            WEBDAV_KEYCHAIN_SERVICE,
        ])?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = credential_id;
        Err(unsupported_secure_storage())
    }
}

#[tauri::command]
pub async fn webdav_test_connection(config: WebDAVConfig) -> Result<String, String> {
    let (host, base_path) = parse_url(&config.url)?;
    let base_path_for_test = if base_path.is_empty() { "/" } else { base_path.as_str() };

    let client = ClientBuilder::new()
        .set_host(host.clone())
        .set_auth(Auth::Basic(config.username.clone(), config.password.clone()))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    // Test 1: Try base_path only
    match client.list(base_path_for_test, Depth::Number(0)).await {
        Ok(_) => eprintln!("[OK] Base path works: {}", base_path_for_test),
        Err(e) => eprintln!("[FAIL] Base path failed: {} - {}", base_path_for_test, e),
    }

    // Test 2: Try with folder
    let path = build_path(&base_path, &config.folder)?;
    match client.list(&path, Depth::Number(0)).await {
        Ok(_) => return Ok(format!("Connected successfully to {}", path)),
        Err(e) => eprintln!("[FAIL] Full path failed: {} - {}", path, e),
    }

    Err(format!("Cannot access {}. Check if the folder exists.", path))
}

#[tauri::command]
pub async fn webdav_list_files(config: WebDAVConfig) -> Result<Vec<FileInfo>, String> {
    let (host, base_path) = parse_url(&config.url)?;
    let path = build_path(&base_path, &config.folder)?;

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
    let (host, base_path) = parse_url(&config.url)?;
    let full_path = build_path(&base_path, &remote_path)?;

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
    let (host, base_path) = parse_url(&config.url)?;
    let full_path = build_path(&base_path, &remote_path)?;

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
    let (host, base_path) = parse_url(&config.url)?;
    let full_path = build_path(&base_path, &remote_path)?;

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
    let (host, base_path) = parse_url(&config.url)?;
    let full_path = build_path(&base_path, &remote_path)?;

    let client = ClientBuilder::new()
        .set_host(host)
        .set_auth(Auth::Basic(config.username, config.password))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;

    client.delete(&full_path)
        .await
        .map_err(|e| format!("Delete failed: {}", e))?;

    Ok("Deleted successfully".to_string())
}

#[cfg(test)]
mod tests {
    use super::{build_path, normalize_remote_path, parse_url};

    #[test]
    fn parse_url_splits_host_and_base_path() {
        let (host, base_path) = parse_url("https://example.com/webdav/root/").unwrap();
        assert_eq!(host, "https://example.com");
        assert_eq!(base_path, "/webdav/root");
    }

    #[test]
    fn build_path_respects_base_path() {
        assert_eq!(build_path("/webdav", "/notes/a.md").unwrap(), "/webdav/notes/a.md");
        assert_eq!(build_path("", "/notes/a.md").unwrap(), "/notes/a.md");
        assert_eq!(build_path("/webdav", "/").unwrap(), "/webdav");
    }

    #[test]
    fn normalize_remote_path_rejects_parent_segments() {
        assert!(normalize_remote_path("../notes").is_err());
        assert!(build_path("/webdav", "../notes/a.md").is_err());
    }

    #[test]
    fn parse_url_rejects_query_strings() {
        assert!(parse_url("https://example.com/webdav?token=1").is_err());
    }
}
