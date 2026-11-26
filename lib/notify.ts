/** 画面の上に出す注意メッセージ（AlertBar が受け取る）。window.alert は埋め込み環境で止められることがあるため使わない */
export function notify(msg: string) {
  window.dispatchEvent(new CustomEvent("app-alert", { detail: msg }));
}
