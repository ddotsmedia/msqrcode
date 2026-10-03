declare const _default: () => {
    port: number;
    database: {
        host: string | undefined;
        port: number;
        user: string | undefined;
        password: string | undefined;
        name: string | undefined;
    };
    redis: {
        host: string;
        port: number;
    };
};
export default _default;
