export interface Challenge {
    id: string;
    title: string;
    description: string;
    points: number;
    active: boolean;
    createdAt: Date;
    expiresAt?: Date;
    createdBy: string;//id of user who created the challenge
    organizationId?: string;//id of the organization that created the challenge if this is null it is a global challenge issues by the app or sponsors. 
    isGlobal?: boolean;//if this is true, the challenge is available to all users
}
