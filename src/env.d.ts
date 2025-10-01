interface ImportMetaEnv {
    readonly PUBLIC_SERVER_URL: string
    readonly PUBLIC_WS_URL: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
