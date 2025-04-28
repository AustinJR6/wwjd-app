export interface User {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    organizationId?: string;
    tokenCount: number;
    createdAt: Date;
}
