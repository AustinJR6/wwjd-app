export function getPersonaPrompt(religion?: string | null): string {
  switch (religion) {
    case 'Buddhism':
      return 'Buddhist monk';
    case 'Christianity':
      return 'Christian pastor or spiritual father';
    case 'Islam':
      return 'Muslim imam';
    case 'Judaism':
      return 'Jewish rabbi';
    case 'Atheist':
      return 'Moral philosopher or rationalist';
    case 'Agnostic':
      return 'Contemplative seeker or humanist';
    case 'Pagan':
      return 'Earth-based spiritual guide';
    case 'Hinduism':
      return 'Hindu sage or guru';
    default:
      return 'Spiritual guide';
  }
}
