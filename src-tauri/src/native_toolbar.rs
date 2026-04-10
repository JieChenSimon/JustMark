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

#[cfg(target_os = "macos")]
fn make_toolbar_delegate(mut decl: ClassDecl) -> Result<&'static Object, String> {
    // SAFETY: register() returns a class registered in the global ObjC runtime.
    // The class persists for the lifetime of the process.
    // add_method is unsafe but we ensure correct method signatures.
    let delegate_class = unsafe {
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
        decl.register()
    };
    // SAFETY: register() returns a class registered in the global ObjC runtime.
    // The class persists for the lifetime of the process.
    let delegate: id = unsafe { msg_send![delegate_class, new] };
    // SAFETY: newly allocated NSObject is always valid
    Ok(unsafe { &*(delegate as *const Object) })
}

#[tauri::command]
pub fn setup_native_toolbar<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use tauri::Manager;

        let window = app.get_webview_window("main")
            .ok_or("Main window not found")?;
        let ns_window = window.ns_window()
            .map_err(|e| e.to_string())? as id;

        // Try primary class name, then fallback with timestamp suffix
        let class_name = "JustMarkToolbarDelegate";
        let decl = ClassDecl::new(class_name, class!(NSObject));

        let decl = match decl {
            Some(d) => d,
            None => {
                // Class name collision — try with timestamp suffix
                let suffix = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_nanos())
                    .unwrap_or(0);
                let fallback_name = format!("JMToolbar{}", suffix);
                ClassDecl::new(&fallback_name, class!(NSObject)).ok_or_else(|| {
                    format!(
                        "Failed to create ObjC delegate class (neither '{}' nor '{}' available — \
                        ObjC runtime may be in an inconsistent state)",
                        class_name, fallback_name
                    )
                })?
            }
        };

        let delegate = make_toolbar_delegate(decl)?;

        // SAFETY: ns_window is a valid NSWindow, toolbar setup is straightforward
        unsafe {
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
