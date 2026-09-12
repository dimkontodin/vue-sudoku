/// WebView2 claims some Ctrl shortcuts as browser commands before the page sees
/// them, so the game's own Ctrl+Z / Ctrl+Y (undo/redo, see `useBoardKeyboard`)
/// worked in a browser tab but not in the .exe. Turning browser accelerators off
/// hands those keys back to the page; F5, Ctrl+P, Ctrl+F, F12 etc. go with them.
/// Text-editing keys and the right-click menu (Paste into the Enter screen,
/// Inspect in dev builds) keep working.
#[cfg(windows)]
fn hand_ctrl_keys_to_page(window: &tauri::WebviewWindow) {
  let reached = window.with_webview(|webview| {
    use webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3;
    use windows_core::Interface;

    let apply = || -> windows_core::Result<()> {
      // SAFETY: plain WebView2 COM calls on the live controller Tauri lends us
      // for the duration of this callback, on the main thread.
      unsafe {
        webview
          .controller()
          .CoreWebView2()?
          .Settings()?
          .cast::<ICoreWebView2Settings3>()?
          .SetAreBrowserAcceleratorKeysEnabled(false)
      }
    };
    if let Err(err) = apply() {
      log::warn!("could not disable WebView2 browser accelerators: {err}");
    }
  });
  if let Err(err) = reached {
    log::warn!("could not reach the WebView2 controller: {err}");
  }
}

pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      #[cfg(windows)]
      {
        use tauri::Manager;
        match app.get_webview_window("main") {
          Some(window) => hand_ctrl_keys_to_page(&window),
          None => log::warn!("no \"main\" window; Ctrl shortcuts stay with WebView2"),
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
