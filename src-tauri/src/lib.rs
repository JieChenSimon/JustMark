mod save_image_command;
mod web_clipper_command;
mod webdav_command;

#[cfg(target_os = "macos")]
mod native_toolbar;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            save_image_command::save_image_from_clipboard,
            web_clipper_command::fetch_url_content,
            webdav_command::webdav_save_password,
            webdav_command::webdav_get_password,
            webdav_command::webdav_delete_password,
            webdav_command::webdav_test_connection,
            webdav_command::webdav_list_files,
            webdav_command::webdav_upload_file,
            webdav_command::webdav_download_file,
            webdav_command::webdav_create_directory,
            webdav_command::webdav_delete_file,
            #[cfg(target_os = "macos")]
            native_toolbar::setup_native_toolbar
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
