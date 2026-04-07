const AVATAR_COLORS = ['#000091', '#6A6AF4', '#009081', '#E4794A', '#CE614A', '#A558A0', '#C3992A', '#417DC4']

export function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function getInitials(name: string): string
export function getInitials(firstname: string, lastname: string): string
export function getInitials(firstOrName: string, lastname?: string): string {
  if (lastname !== undefined) {
    return `${firstOrName.charAt(0)}${lastname.charAt(0)}`.toUpperCase()
  }
  return firstOrName
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
