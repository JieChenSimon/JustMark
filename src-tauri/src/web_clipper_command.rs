use reqwest::header::{HeaderMap, HeaderValue, USER_AGENT, ACCEPT, ACCEPT_LANGUAGE};

/// Fetches HTML content from a given URL
/// Returns the HTML string or an error message
#[tauri::command]
pub async fn fetch_url_content(url: String) -> Result<String, String> {
    // Validate URL format
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Invalid URL: must start with http:// or https://".to_string());
    }

    // Build headers to mimic a browser request
    let mut headers = HeaderMap::new();
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
    );
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"),
    );
    headers.insert(
        ACCEPT_LANGUAGE,
        HeaderValue::from_static("zh-CN,zh;q=0.9,en;q=0.8,en-US;q=0.7"),
    );
    // Note: reqwest with gzip/brotli features automatically handles Accept-Encoding
    // and decompresses responses

    // Create HTTP client with timeout and automatic decompression
    let client = reqwest::Client::builder()
        .default_headers(headers)
        .timeout(std::time::Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(10))
        .gzip(true)
        .brotli(true)
        .deflate(true)
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Fetch the URL content
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    // Check response status
    if !response.status().is_success() {
        return Err(format!(
            "HTTP error: {} - {}",
            response.status().as_u16(),
            response.status().canonical_reason().unwrap_or("Unknown")
        ));
    }

    // Get content-type header to determine encoding
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_lowercase();
    
    // Try to detect charset from content-type
    let charset = if content_type.contains("charset=") {
        content_type
            .split("charset=")
            .nth(1)
            .map(|s| s.split(';').next().unwrap_or("").trim().to_lowercase())
    } else {
        None
    };

    // Get response bytes (already decompressed by reqwest)
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    // Convert bytes to string with proper encoding
    let html = if charset.as_deref() == Some("gb2312") || charset.as_deref() == Some("gbk") || charset.as_deref() == Some("gb18030") {
        // For Chinese GBK/GB2312 encoding
        let (cow, _, _) = encoding_rs::GBK.decode(&bytes);
        cow.into_owned()
    } else {
        // Default to UTF-8 with lossy conversion
        String::from_utf8_lossy(&bytes).into_owned()
    };

    // Also check meta charset in HTML if not specified in header
    let final_html = if charset.is_none() {
        let html_lower = html.to_lowercase();
        if html_lower.contains("charset=gb") || html_lower.contains("charset=\"gb") || html_lower.contains("charset='gb") {
            // Re-decode as GBK if meta tag indicates GBK encoding
            let (cow, _, _) = encoding_rs::GBK.decode(&bytes);
            cow.into_owned()
        } else {
            html
        }
    } else {
        html
    };

    Ok(final_html)
}
