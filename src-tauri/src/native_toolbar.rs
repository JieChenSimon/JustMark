#[cfg(target_os = "macos")]
use cocoa::base::{id, nil, YES};
#[cfg(target_os = "macos")]
use cocoa::foundation::{NSArray, NSString};
#[cfg(target_os = "macos")]
use objc::{class, msg_send, sel, sel_impl, runtime::Object};
#[cfg(target_os = "macos")]
use objc::declare::ClassDecl;
#[cfg(target_os = "macos")]
use objc::runtime::Sel;
use tauri::{AppHandle, Runtime};

#[cfg(target_os = "macos")]
extern "C" fn toolbar_items(_: &Object, _: Sel, _: id) -> id {
    unsafe { NSArray::array(nil) }
}

#[cfg(target_os = "macos")]
extern "C" fn toolbar_item(_: &Object, _: Sel, _: id, _: id, _: bool) -> id {
    nil
}

#[tauri::command]
pub fn setup_native_toolbar<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;

        let window = app.get_webview_window("main")
            .ok_or("Main window not found")?;

        unsafe {
            let ns_window = window.ns_window()
                .map_err(|e| e.to_string())? as id;

            let mut decl = ClassDecl::new("JustMarkToolbarDelegate", class!(NSObject))
                .ok_or("Failed to create delegate class")?;

            decl.add_method(
                sel!(toolbarDefaultItemIdentifiers:),
                toolbar_items as extern "C" fn(&Object, Sel, id) -> id,
            );
            decl.add_method(
                sel!(toolbarAllowedItemIdentifiers:),
                toolbar_items as extern "C" fn(&Object, Sel, id) -> id,
            );
            decl.add_method(
                sel!(toolbar:itemForItemIdentifier:willBeInsertedIntoToolbar:),
                toolbar_item as extern "C" fn(&Object, Sel, id, id, bool) -> id,
            );

            let delegate_class = decl.register();
            let delegate: id = msg_send![delegate_class, new];

            let toolbar: id = msg_send![class!(NSToolbar), alloc];
            let identifier = NSString::alloc(nil).init_str("MainToolbar");
            let toolbar: id = msg_send![toolbar, initWithIdentifier: identifier];
            let _: () = msg_send![toolbar, setDelegate: delegate];
            let _: () = msg_send![toolbar, setDisplayMode: 2];
            let _: () = msg_send![toolbar, setAllowsUserCustomization: YES];
            let _: () = msg_send![ns_window, setToolbar: toolbar];
        }

        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    Err("Native toolbar only supported on macOS".to_string())
}
