export interface Organization {
    id: string;
    name: string;
    domain?: string;
    planType: 'basic' | 'premium' | 'enterprise';
    seatLimit: number;
    createdAt: Date;
}
