type User = {
  _id?: string
  username: string
  oracleUser?: string
  roles: string[]
  bannerId?: string
  pidm?: string
  email?: string
  name?: string
  preferred?: string
  last?: string
  lastLogin?: Date
  settings?: {
    dark: boolean
  }
  name_id?: string
  session_index?: string
}

type DirectoryEntry = {
  pidm: string
  bannerId: string
  name: {
    first: string
    last: string
  }
  person: string
  active: boolean
  ldap: string
  prox: string
  email: string
  phone: string
  year: string
  gender: string
  location: {
    building: string
    room: string
    hall: string
    department: string
    box: string
  }
  jobTitle: string
  photoPath: string
  photo: unknown
  photoLocked: boolean
}

export type { User, DirectoryEntry }
