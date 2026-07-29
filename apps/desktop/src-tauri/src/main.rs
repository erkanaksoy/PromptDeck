mod bridge;
mod db;
mod protocol;

use bridge::BridgeChannel;
use db::Database;
use protocol::validate_message;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartManagerExt};

struct AppState {
    database: Arc<Database>,
    bridge: Arc<BridgeChannel>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DesktopPreferences {
    theme: String,
    mode: String,
    view_mode: String,
    always_on_top: bool,
    compact_density: String,
    compact_filter: String,
    platform_filter: Option<String>,
    show_idle: bool,
    show_recent: bool,
    show_labels: bool,
    show_timestamps: bool,
    close_to_tray: bool,
    launch_minimized: bool,
    launch_mode: String,
    start_with_windows: bool,
}

impl Default for DesktopPreferences {
    fn default() -> Self {
        Self {
            theme: "system".into(),
            mode: "full".into(),
            view_mode: "grid".into(),
            always_on_top: false,
            compact_density: "comfortable".into(),
            compact_filter: "attention".into(),
            platform_filter: None,
            show_idle: true,
            show_recent: true,
            show_labels: true,
            show_timestamps: true,
            close_to_tray: true,
            launch_minimized: false,
            launch_mode: "full".into(),
            start_with_windows: false,
        }
    }
}

#[tauri::command]
fn get_cached_state(state: State<'_, AppState>) -> Result<Value, String> {
    let conversations = state
        .database
        .conversations()
        .map_err(|error| error.to_string())?;
    let connected = state.bridge.is_connected();
    let preferences = state
        .database
        .get_setting("desktop_preferences")
        .map_err(|error| error.to_string())?
        .unwrap_or_else(|| {
            serde_json::to_value(DesktopPreferences::default()).expect("serialize defaults")
        });
    Ok(json!({
        "conversations": conversations,
        "connectionState": if connected { "connected" } else { "extension_not_connected" },
        "lastSyncAt": Value::Null,
        "stale": !connected,
        "preferences": preferences,
        "databasePath": state.database.path()
    }))
}

#[tauri::command]
fn desktop_command(message: Value, state: State<'_, AppState>) -> Result<(), String> {
    validate_message(&message).map_err(|error| error.to_string())?;
    let bytes = serde_json::to_vec(&message).map_err(|error| error.to_string())?;
    state.bridge.send(bytes)
}

#[tauri::command]
fn set_always_on_top(window: WebviewWindow, enabled: bool) -> Result<(), String> {
    window
        .set_always_on_top(enabled)
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_window_mode(window: WebviewWindow, mode: String) -> Result<(), String> {
    if !matches!(mode.as_str(), "full" | "compact") {
        return Err("Invalid window mode".into());
    }
    let size = if mode == "compact" {
        PhysicalSize::new(420, 780)
    } else {
        PhysicalSize::new(1280, 820)
    };
    window.set_size(size).map_err(|error| error.to_string())
}

#[tauri::command]
fn reset_window_position(window: WebviewWindow) -> Result<(), String> {
    let monitor = window
        .primary_monitor()
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Primary monitor unavailable".to_string())?;
    let work = monitor.position();
    let size = monitor.size();
    let window_size = window.outer_size().map_err(|error| error.to_string())?;
    let x = work.x + ((size.width.saturating_sub(window_size.width)) / 2) as i32;
    let y = work.y + ((size.height.saturating_sub(window_size.height)) / 2) as i32;
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable()
    } else {
        manager.disable()
    }
    .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_desktop_preferences(
    preferences: DesktopPreferences,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if !matches!(preferences.theme.as_str(), "light" | "dark" | "system")
        || !matches!(preferences.mode.as_str(), "full" | "compact")
        || !matches!(preferences.view_mode.as_str(), "grid" | "kanban")
        || !matches!(
            preferences.compact_density.as_str(),
            "comfortable" | "dense"
        )
        || !matches!(
            preferences.compact_filter.as_str(),
            "attention" | "active" | "all"
        )
        || preferences
            .platform_filter
            .as_deref()
            .is_some_and(|value| !matches!(value, "chatgpt" | "claude" | "gemini"))
    {
        return Err("Invalid desktop preferences".into());
    }
    state
        .database
        .set_setting(
            "desktop_preferences",
            &serde_json::to_value(preferences).map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())
}

fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn configure_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show PromptDeck", true, None::<&str>)?;
    let hide = MenuItem::with_id(app, "hide", "Hide PromptDeck", true, None::<&str>)?;
    let full = MenuItem::with_id(app, "full", "Full Dashboard", true, None::<&str>)?;
    let compact = MenuItem::with_id(app, "compact", "Compact Panel", true, None::<&str>)?;
    let always = CheckMenuItem::with_id(app, "always", "Always on Top", true, false, None::<&str>)?;
    let sync = MenuItem::with_id(app, "sync", "Sync Now", true, None::<&str>)?;
    let autostart = CheckMenuItem::with_id(
        app,
        "autostart",
        "Start with Windows",
        true,
        app.autolaunch().is_enabled().unwrap_or(false),
        None::<&str>,
    )?;
    let settings = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
    let exit = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(
        app,
        &[
            &show, &hide, &separator, &full, &compact, &always, &sync, &autostart, &settings,
            &separator, &exit,
        ],
    )?;
    let icon = app
        .default_window_icon()
        .cloned()
        .expect("application icon");
    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("PromptDeck Desktop")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_window(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| {
            let Some(window) = app.get_webview_window("main") else {
                return;
            };
            match event.id().as_ref() {
                "show" => show_window(app),
                "hide" => {
                    let _ = window.hide();
                }
                "full" => {
                    let _ = window.set_size(PhysicalSize::new(1280, 820));
                    let _ = window.eval(
                        "window.dispatchEvent(new CustomEvent('promptdeck-set-mode',{detail:'full'}))",
                    );
                    show_window(app);
                }
                "compact" => {
                    let _ = window.set_size(PhysicalSize::new(420, 780));
                    let _ = window.eval(
                        "window.dispatchEvent(new CustomEvent('promptdeck-set-mode',{detail:'compact'}))",
                    );
                    show_window(app);
                }
                "always" => {
                    if let Ok(value) = window.is_always_on_top() {
                        let _ = window.set_always_on_top(!value);
                    }
                }
                "sync" => {
                    if let Some(state) = app.try_state::<AppState>() {
                        let message = json!({
                            "protocolVersion": 1,
                            "messageId": uuid::Uuid::new_v4().to_string(),
                            "sentAt": chrono::Utc::now().timestamp_millis(),
                            "source": "desktop",
                            "type": "REQUEST_FULL_STATE",
                            "payload": {}
                        });
                        let _ = state.bridge.send(serde_json::to_vec(&message).unwrap());
                    }
                }
                "autostart" => {
                    let manager = app.autolaunch();
                    if manager.is_enabled().unwrap_or(false) {
                        let _ = manager.disable();
                    } else {
                        let _ = manager.enable();
                    }
                }
                "settings" => {
                    show_window(app);
                    let _ =
                        window.eval("window.dispatchEvent(new Event('promptdeck-open-settings'))");
                }
                "exit" => app.exit(0),
                _ => {}
            }
        })
        .build(app)?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .max_file_size(2_000_000)
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            let app_data = app.path().app_data_dir()?;
            let database = Arc::new(Database::open(&app_data.join("promptdeck.db"))?);
            let bridge = Arc::new(BridgeChannel::default());
            let preferences: DesktopPreferences = database
                .get_setting("desktop_preferences")
                .ok()
                .flatten()
                .and_then(|value| serde_json::from_value(value).ok())
                .unwrap_or_default();
            app.manage(AppState {
                database: database.clone(),
                bridge: bridge.clone(),
            });
            configure_tray(app.handle())?;
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(preferences.always_on_top);
                let size = if preferences.launch_mode == "compact" {
                    PhysicalSize::new(420, 780)
                } else {
                    PhysicalSize::new(1280, 820)
                };
                let _ = window.set_size(size);
                if preferences.launch_minimized
                    || std::env::args().any(|argument| argument == "--minimized")
                {
                    let _ = window.hide();
                }
            }
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(
                async move { bridge::run(app_handle, database, bridge).await },
            );
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let close_to_tray = window
                    .app_handle()
                    .try_state::<AppState>()
                    .and_then(|state| {
                        state
                            .database
                            .get_setting("desktop_preferences")
                            .ok()
                            .flatten()
                    })
                    .and_then(|value| serde_json::from_value::<DesktopPreferences>(value).ok())
                    .is_none_or(|preferences| preferences.close_to_tray);
                if close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_cached_state,
            desktop_command,
            set_always_on_top,
            set_window_mode,
            reset_window_position,
            set_autostart,
            save_desktop_preferences
        ])
        .run(tauri::generate_context!())
        .expect("PromptDeck Desktop failed to start");
}
