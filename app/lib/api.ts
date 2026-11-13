export interface NewsItem {
  id: string;
  title: string | null;
  content: string;
  image: string | null;
  isPinned: boolean;
  authorName: string | null;
  authorRole: string | null;
  author?: {
    id: string;
    name: string;
    role: string;
    avatar: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface NewsResponse {
  data: NewsItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  grades?: string[];
  servantRole?: string;
  classIds?: string[];
  avatar?: string | null;
}

const PRIVILEGED_USER_ROLES = new Set(["admin", "priest"]);
const PRIVILEGED_SERVANT_ROLES = new Set(["مسؤول", "أب كاهن"]);

/** True for the roles that may administer every class. */
export function isPrivilegedUser(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return (
    PRIVILEGED_USER_ROLES.has(user.role) ||
    (!!user.servantRole && PRIVILEGED_SERVANT_ROLES.has(user.servantRole))
  );
}

/**
 * True when the user may modify this class. Every servant may *view* any
 * class, but writes remain limited to the classes assigned to them.
 */
export function canManageClass(
  user: AuthUser | null | undefined,
  classId: string | null | undefined,
): boolean {
  if (!user) return false;
  if (isPrivilegedUser(user)) return true;
  return !!classId && Array.isArray(user.classIds) && user.classIds.includes(classId);
}

export interface ClassItem {
  id: string;
  name: string;
  grade: string;
  academicYear: string;
  description?: string | null;
  image?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  leadServantId?: string | null;
  leadServant?: {
    id: string;
    name: string;
  } | null;
  servants?: Array<{
    id: string;
    name: string;
    phone: string;
    role: string;
  }>;
  children?: Array<{
    id: string;
    name: string;
    phone?: string;
  }>;
  childrenCount?: number;
  servantsCount?: number;
  createdAt?: string;
}

export interface ChildItem {
  id: string;
  name: string;
  birthDate?: string;
  gender?: 'male' | 'female';
  address?: string | null;
  parentName?: string | null;
  parentPhone?: string;
  phone?: string;
  notes?: string | null;
  avatar?: string | null;
  classId?: string | null;
  class?: {
    id: string;
    name: string;
    grade?: string;
  } | null;
  assignedServantId?: string | null;
  assignedServant?: { id: string; name: string | null } | null;
  createdAt?: string;
}

export interface ServantItem {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  role: string;
  avatar?: string | null;
  classes?: ClassItem[];
  createdAt?: string;
}

export interface AttendanceRecord {
  id: string;
  childId: string;
  classId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string | null;
  child?: {
    id: string;
    name: string;
  };
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL !== undefined ? process.env.NEXT_PUBLIC_API_URL : '';

export function getImageUrl(imagePath?: string | null): string {
  if (!imagePath) return '';
  if (
    imagePath.startsWith('http://') ||
    imagePath.startsWith('https://') ||
    imagePath.startsWith('data:')
  ) {
    return imagePath;
  }
  return `${API_BASE}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
}

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('ss_token');
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('ss_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, user: AuthUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('ss_token', token);
  localStorage.setItem('ss_user', JSON.stringify(user));
}

export function clearStoredAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('ss_token');
  localStorage.removeItem('ss_user');
}

const PUBLIC_PAGE_PATHS = new Set([
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-otp',
  '/churches',
  '/join',
  '/privacy',
  '/terms',
]);

function isPublicPage(): boolean {
  if (typeof window === 'undefined') return true;
  const path = window.location.pathname;
  return PUBLIC_PAGE_PATHS.has(path) || path.startsWith('/register/church');
}

/**
 * Sends the browser through the server logout route so the httpOnly session
 * and refresh cookies are cleared before landing on the login screen. Without
 * this, the proxy would keep redirecting an expired session to the dashboard.
 */
function handleExpiredSession(): void {
  if (typeof window === 'undefined' || isPublicPage()) return;
  if (expiredSessionRedirect) return;
  expiredSessionRedirect = true;
  clearStoredAuth();
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/logout?next=${encodeURIComponent(next)}`);
}

/** Prevents concurrent 401s from stacking multiple logout navigations. */
let expiredSessionRedirect = false;

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (!res.ok) return null;
        const data = (await res.json()) as {
          accessToken?: string;
          user?: AuthUser;
        };
        if (data.accessToken && data.user) {
          setStoredAuth(data.accessToken, data.user);
          return data.accessToken;
        }
        return null;
      } catch {
        return null;
      }
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const authToken = token ?? getStoredToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  const send = () =>
    fetch(url, {
      ...options,
      headers,
    });

  let res = await send();

  if (res.status === 401 && !endpoint.startsWith('/api/auth/')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${refreshed}`;
      res = await send();
    } else {
      handleExpiredSession();
    }
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message =
      (Array.isArray(errorData.message)
        ? errorData.message.join(', ')
        : errorData.message) || `فشل الطلب (${res.status})`;
    throw new Error(message);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

// ======================== AUTH ========================

export async function loginUser(
  identifier: string,
  password: string,
): Promise<{ accessToken: string; user: AuthUser }> {
  const isEmail = identifier.includes('@');
  const payload = isEmail
    ? { email: identifier, password }
    : { phone: identifier, password };

  const data = await request<{ accessToken: string; user: AuthUser }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  setStoredAuth(data.accessToken, data.user);
  return data;
}

export async function registerUser(payload: {
  name: string;
  email: string;
  phone: string;
  password: string;
  servantRole?: string;
  classIds?: string[];
  grades?: string[];
}): Promise<{ accessToken: string; user: AuthUser }> {
  const data = await request<{ accessToken: string; user: AuthUser }>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  if (data.accessToken && data.user) {
    setStoredAuth(data.accessToken, data.user);
  }

  return data;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const user = await request<AuthUser>('/api/auth/me');
  const token = getStoredToken();
  if (token && user) {
    setStoredAuth(token, user);
  }
  return user;
}

export async function updateUserProfile(
  id: string,
  payload: {
    name?: string;
    phone?: string;
    grades?: string[];
  },
): Promise<AuthUser> {
  const updated = await request<AuthUser>(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

  const currentUser = getStoredUser();
  const token = getStoredToken();
  if (currentUser && currentUser.id === id && token) {
    setStoredAuth(token, { ...currentUser, ...updated });
  }

  return updated;
}

export async function uploadUserAvatar(
  id: string,
  file: File,
): Promise<{ message: string; avatar: string }> {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await request<{ message: string; avatar: string }>(
    `/api/users/${id}/avatar`,
    {
      method: 'PATCH',
      body: formData,
    },
  );

  const currentUser = getStoredUser();
  const token = getStoredToken();
  if (currentUser && currentUser.id === id && token) {
    setStoredAuth(token, { ...currentUser, avatar: res.avatar });
  }

  return res;
}

export async function deleteUserAvatar(
  id: string,
): Promise<{ message: string }> {
  const res = await request<{ message: string }>(`/api/users/${id}/avatar`, {
    method: 'DELETE',
  });

  const currentUser = getStoredUser();
  const token = getStoredToken();
  if (currentUser && currentUser.id === id && token) {
    setStoredAuth(token, { ...currentUser, avatar: null });
  }

  return res;
}

export async function changeUserPassword(
  id: string,
  payload: { oldPassword: string; newPassword: string },
): Promise<{ message: string }> {
  return request(`/api/users/${id}/password`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  return request('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(payload: {
  email: string;
  code: string;
  newPassword: string;
}): Promise<{ message: string }> {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ======================== NEWS ========================

export async function getNews(
  search?: string,
  page = 1,
  limit = 20,
): Promise<NewsResponse> {
  const params = new URLSearchParams();
  if (search && search.trim()) params.append('search', search.trim());
  params.append('page', String(page));
  params.append('limit', String(limit));

  return request(`/api/news?${params.toString()}`, { cache: 'no-store' });
}

export async function createNews(
  data: {
    content: string;
    title?: string;
    isPinned?: boolean;
    imageFile?: File | null;
  },
  token?: string,
): Promise<NewsItem> {
  const formData = new FormData();
  formData.append('content', data.content);
  if (data.title && data.title.trim()) {
    formData.append('title', data.title.trim());
  }
  if (data.isPinned !== undefined) {
    formData.append('isPinned', String(data.isPinned));
  }
  if (data.imageFile) {
    formData.append('image', data.imageFile);
  }

  return request('/api/news', {
    method: 'POST',
    body: formData,
  }, token);
}

export async function deleteNews(id: string, token?: string): Promise<void> {
  return request(`/api/news/${id}`, { method: 'DELETE' }, token);
}

// ======================== CLASSES ========================

export async function getClasses(search?: string, includeInactive = false): Promise<ClassItem[]> {
  const params = new URLSearchParams();
  if (search && search.trim()) params.append('search', search.trim());
  if (includeInactive) params.append('includeInactive', 'true');
  const res = await request<ClassItem[] | { data: ClassItem[] }>(
    `/api/classes?${params.toString()}`,
    { cache: 'no-store' },
  );
  return Array.isArray(res) ? res : res.data || [];
}

export async function getClass(id: string): Promise<ClassItem> {
  return request(`/api/classes/${id}`, { cache: 'no-store' });
}

export async function createClass(data: {
  name: string;
  description?: string | null;
}): Promise<ClassItem> {
  return request('/api/classes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClass(
  id: string,
  data: Partial<{ name: string; description: string | null; isActive: boolean; sortOrder: number }>,
): Promise<ClassItem> {
  return request(`/api/classes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function reorderClasses(ids: string[]): Promise<void> {
  await request('/api/classes', {
    method: 'PATCH',
    body: JSON.stringify({ order: ids }),
  });
}

export async function restoreDefaultClasses(): Promise<void> {
  await request('/api/classes/restore-defaults', { method: 'POST' });
}

export async function deleteClass(id: string): Promise<void> {
  return request(`/api/classes/${id}`, { method: 'DELETE' });
}

export async function uploadClassImage(
  id: string,
  file: File,
): Promise<{ message: string; image: string }> {
  const formData = new FormData();
  formData.append('image', file);
  return request(`/api/classes/${id}/image`, {
    method: 'PATCH',
    body: formData,
  });
}

export async function deleteClassImage(
  id: string,
): Promise<{ message: string }> {
  return request(`/api/classes/${id}/image`, { method: 'DELETE' });
}

// ======================== CHILDREN ========================

export async function getChildren(paramsObj?: {
  search?: string;
  classId?: string;
  grade?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: ChildItem[]; total: number }> {
  const params = new URLSearchParams();
  if (paramsObj?.search) params.append('search', paramsObj.search);
  if (paramsObj?.classId) params.append('classId', paramsObj.classId);
  if (paramsObj?.grade) params.append('grade', paramsObj.grade);
  if (paramsObj?.page) params.append('page', String(paramsObj.page));
  if (paramsObj?.limit) params.append('limit', String(paramsObj.limit));

  const res = await request<{ data: ChildItem[]; total: number } | ChildItem[]>(
    `/api/children?${params.toString()}`,
    { cache: 'no-store' },
  );

  if (Array.isArray(res)) {
    return { data: res, total: res.length };
  }
  return res;
}

export async function getChild(id: string): Promise<ChildItem> {
  return request(`/api/children/${id}`, { cache: 'no-store' });
}

export async function createChild(data: {
  name: string;
  birthDate?: string;
  gender?: 'male' | 'female';
  parentPhone?: string | null;
  address?: string;
  parentName?: string;
  notes?: string;
  classId?: string;
  phone?: string;
  assignedServantId?: string | null;
}): Promise<ChildItem> {
  return request('/api/children', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateChild(
  id: string,
  data: Partial<{
    name: string;
    birthDate: string;
    gender: 'male' | 'female';
    parentPhone: string;
    address: string;
    parentName: string;
    notes: string;
    classId: string;
    phone: string;
    assignedServantId: string | null;
  }>,
): Promise<ChildItem> {
  return request(`/api/children/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteChild(id: string): Promise<void> {
  return request(`/api/children/${id}`, { method: 'DELETE' });
}

// ======================== SERVANTS ========================

export async function getServants(search?: string): Promise<{ data: ServantItem[]; total: number }> {
  const params = new URLSearchParams();
  if (search && search.trim()) params.append('search', search.trim());
  const res = await request<{ data: ServantItem[]; total: number } | ServantItem[]>(
    `/api/servants?${params.toString()}`,
    { cache: 'no-store' },
  );
  if (Array.isArray(res)) {
    return { data: res, total: res.length };
  }
  return res;
}

export async function createServant(data: {
  name: string;
  phone: string;
  email?: string;
  role?: string;
  classIds?: string[];
}): Promise<ServantItem> {
  return request('/api/servants', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteServant(id: string): Promise<void> {
  return request(`/api/servants/${id}`, { method: 'DELETE' });
}

export async function uploadServantAvatar(
  id: string,
  file: File,
): Promise<{ message: string; avatar: string }> {
  const formData = new FormData();
  formData.append('avatar', file);
  return request(`/api/servants/${id}/avatar`, {
    method: 'PATCH',
    body: formData,
  });
}

export async function deleteServantAvatar(
  id: string,
): Promise<{ message: string }> {
  return request(`/api/servants/${id}/avatar`, { method: 'DELETE' });
}

export async function bookServantVisitation(data: {
  childId: string;
  servantId: string;
  date: string;
}): Promise<{ id: string }> {
  return request('/api/visitations', {
    method: 'POST',
    body: JSON.stringify({ ...data, type: 'home_visit', status: 'planned' }),
  });
}

// ======================== ATTENDANCE ========================

export async function getAttendance(
  classId?: string,
  date?: string,
): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams();
  if (classId) params.append('classId', classId);
  if (date) params.append('date', date);

  const res = await request<AttendanceRecord[] | { data: AttendanceRecord[] }>(
    `/api/attendance?${params.toString()}`,
    { cache: 'no-store' },
  );
  return Array.isArray(res) ? res : res.data || [];
}

export async function recordAttendanceBulk(data: {
  classId: string;
  date: string;
  status?: 'present' | 'absent' | 'late' | 'excused';
  records: Array<{
    childId: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    notes?: string;
  }>;
  notes?: string;
}): Promise<{ count: number; sessionId?: string; alerts?: number }> {
  return request('/api/attendance/bulk', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getAttendanceSummary(
  classId: string,
  date: string,
): Promise<{ total: number; present: number; absent: number; late: number; excused: number }> {
  const params = new URLSearchParams({ classId, date });
  return request(`/api/attendance/summary?${params.toString()}`, {
    cache: 'no-store',
  });
}

// ======================== STUDENT 360 ========================

export interface ResponsibleServant {
  id: string;
  name: string | null;
  phone: string | null;
  role: string;
  avatar?: string | null;
}

export interface StudentStats {
  attendanceRate: number | null;
  totalSessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  absencesLast30: number;
  currentStreak: number;
  lastAttendanceDate: string | null;
  lastVisitDate: string | null;
  openFollowUps: number;
  progressAverage: number | null;
  progressEntries: number;
}

export interface TimelineItem {
  id: string;
  type: 'attendance' | 'visitation' | 'follow_up' | 'activity' | 'progress' | 'note';
  title: string;
  description: string | null;
  date: string;
  status?: string | null;
  href?: string | null;
}

export interface StudentProfile {
  student: {
    id: string;
    name: string;
    birthDate: string;
    gender: string;
    parentPhone: string | null;
    parentName: string | null;
    address: string | null;
    notes: string | null;
    phone: string | null;
    avatar: string | null;
    classId: string | null;
    assignedServantId: string | null;
    createdAt: string;
    updatedAt: string;
    class: { id: string; name: string | null; grade: string | null } | null;
    assignedServant: { id: string; name: string | null } | null;
    responsibleServants: ResponsibleServant[];
  };
  stats: StudentStats;
  attendance: Array<{
    id: string;
    date: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    notes: string | null;
    classId: string;
    className: string | null;
  }>;
  progress: Array<{
    id: string;
    subject: string;
    level: string;
    score: string | number | null;
    notes: string | null;
    assessedAt: string;
    assessorName: string | null;
  }>;
  visitations: Array<{
    id: string;
    date: string;
    type: string;
    status: string;
    notes: string | null;
    followUpDate: string | null;
    servantName: string | null;
    servantId: string | null;
  }>;
  followUps: FollowUpCase[];
  notes: StudentNote[];
  activities: Array<{
    id: string;
    followUpId: string;
    type: string;
    title: string;
    notes: string | null;
    occurredAt: string;
    actorName: string | null;
  }>;
  timeline: TimelineItem[];
  permissions: { canWrite: boolean; canViewPrivateNotes: boolean; manager: boolean };
}

export async function getStudentProfile(
  id: string,
  options?: { timelineLimit?: number; historyDays?: number },
): Promise<StudentProfile> {
  const params = new URLSearchParams();
  if (options?.timelineLimit) params.append('timelineLimit', String(options.timelineLimit));
  if (options?.historyDays) params.append('historyDays', String(options.historyDays));
  return request(`/api/children/${id}/profile?${params.toString()}`, { cache: 'no-store' });
}

// ======================== STUDENT NOTES ========================

export interface StudentNote {
  id: string;
  visibility: 'class' | 'leaders' | 'private';
  body: string;
  authorId: string | null;
  authorName?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export async function getStudentNotes(childId: string): Promise<{ data: StudentNote[] }> {
  return request(`/api/children/${childId}/notes`, { cache: 'no-store' });
}

export async function createStudentNote(
  childId: string,
  data: { body: string; visibility?: 'class' | 'leaders' | 'private' },
): Promise<StudentNote> {
  return request(`/api/children/${childId}/notes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateStudentNote(
  childId: string,
  noteId: string,
  data: { body?: string; visibility?: 'class' | 'leaders' | 'private' },
): Promise<StudentNote> {
  return request(`/api/children/${childId}/notes/${noteId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteStudentNote(childId: string, noteId: string): Promise<void> {
  return request(`/api/children/${childId}/notes/${noteId}`, { method: 'DELETE' });
}

// ======================== EDUCATIONAL PROGRESS ========================

export interface EducationalProgress {
  id: string;
  subject: string;
  level: 'beginner' | 'growing' | 'proficient' | 'advanced';
  score: string | number | null;
  notes: string | null;
  assessedAt: string;
  assessorName?: string | null;
  createdAt?: string;
}

export async function getEducationalProgress(
  childId: string,
): Promise<{ data: EducationalProgress[] }> {
  return request(`/api/children/${childId}/progress`, { cache: 'no-store' });
}

export async function createEducationalProgress(
  childId: string,
  data: {
    subject: string;
    level: EducationalProgress['level'];
    score?: number | null;
    notes?: string | null;
    assessedAt?: string;
  },
): Promise<EducationalProgress> {
  return request(`/api/children/${childId}/progress`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateEducationalProgress(
  childId: string,
  progressId: string,
  data: Partial<{
    subject: string;
    level: EducationalProgress['level'];
    score: number | null;
    notes: string | null;
    assessedAt: string;
  }>,
): Promise<EducationalProgress> {
  return request(`/api/children/${childId}/progress/${progressId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteEducationalProgress(
  childId: string,
  progressId: string,
): Promise<void> {
  return request(`/api/children/${childId}/progress/${progressId}`, { method: 'DELETE' });
}

// ======================== FOLLOW-UPS ========================

export type FollowUpStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed';
export type FollowUpPriority = 'low' | 'medium' | 'high';

export interface FollowUpCase {
  id: string;
  childId: string;
  classId: string | null;
  servantId: string | null;
  ruleId: string | null;
  visitationId: string | null;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  source: 'rule' | 'manual' | 'visitation';
  reason: string;
  dueDate: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
  child: { id: string; name: string };
  class: { id: string; name: string | null } | null;
  servant: { id: string; name: string | null } | null;
  activityCount: number;
  lastActivityAt: string | null;
}

export interface FollowUpSummary {
  open: number;
  inProgress: number;
  overdue: number;
  resolved: number;
  total: number;
}

export interface FollowUpListResponse {
  data: FollowUpCase[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    summary: FollowUpSummary;
  };
}

export async function getFollowUps(paramsObj?: {
  status?: FollowUpStatus | 'active';
  classId?: string;
  servantId?: string;
  priority?: FollowUpPriority;
  search?: string;
  overdue?: boolean;
  page?: number;
  limit?: number;
}): Promise<FollowUpListResponse> {
  const params = new URLSearchParams();
  if (paramsObj?.status) params.append('status', paramsObj.status);
  if (paramsObj?.classId) params.append('classId', paramsObj.classId);
  if (paramsObj?.servantId) params.append('servantId', paramsObj.servantId);
  if (paramsObj?.priority) params.append('priority', paramsObj.priority);
  if (paramsObj?.search) params.append('search', paramsObj.search);
  if (paramsObj?.overdue) params.append('overdue', 'true');
  if (paramsObj?.page) params.append('page', String(paramsObj.page));
  if (paramsObj?.limit) params.append('limit', String(paramsObj.limit));
  return request(`/api/follow-ups?${params.toString()}`, { cache: 'no-store' });
}

export interface FollowUpActivity {
  id: string;
  type: string;
  title: string;
  notes: string | null;
  occurredAt: string;
  actorName: string | null;
  actorId: string | null;
}

export interface FollowUpDetail {
  followUp: FollowUpCase;
  child: { id: string; name: string; classId: string | null; className: string | null };
  activities: FollowUpActivity[];
}

export async function getFollowUp(id: string): Promise<FollowUpDetail> {
  return request(`/api/follow-ups/${id}`, { cache: 'no-store' });
}

export async function createFollowUp(data: {
  childId: string;
  servantId?: string | null;
  priority?: FollowUpPriority;
  reason: string;
  dueDate?: string | null;
}): Promise<{ followUp: FollowUpCase }> {
  return request('/api/follow-ups', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateFollowUp(
  id: string,
  data: Partial<{
    status: FollowUpStatus;
    priority: FollowUpPriority;
    servantId: string | null;
    dueDate: string | null;
    resolutionNotes: string | null;
  }>,
): Promise<{ followUp: FollowUpCase }> {
  return request(`/api/follow-ups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function addFollowUpActivity(
  id: string,
  data: { type: 'note' | 'call' | 'message' | 'visit'; title: string; notes?: string },
): Promise<{ activity: FollowUpActivity }> {
  return request(`/api/follow-ups/${id}/activities`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export interface FollowUpRule {
  id: string;
  code: string;
  name: string;
  description: string | null;
  ruleType: 'repeated_absence' | 'declining_attendance' | 'overdue_visitation' | 'pending_follow_up';
  threshold: number;
  windowDays: number;
  priority: FollowUpPriority;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function getFollowUpRules(): Promise<{ data: FollowUpRule[] }> {
  return request('/api/follow-ups/rules', { cache: 'no-store' });
}

export async function updateFollowUpRule(
  id: string,
  data: Partial<{ threshold: number; windowDays: number; isActive: boolean; priority: FollowUpPriority }>,
): Promise<{ rule: FollowUpRule }> {
  return request(`/api/follow-ups/rules/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export interface EvaluationAlert {
  childId: string;
  childName: string;
  ruleCode: string;
  reason: string;
  action: 'create' | 'notify';
  created: boolean;
}

export async function evaluateFollowUps(data?: {
  classId?: string;
  childId?: string;
  dryRun?: boolean;
}): Promise<{
  rules: number;
  evaluatedStudents: number;
  created: number;
  flagged: number;
  skipped: number;
  alerts: EvaluationAlert[];
  dryRun?: boolean;
}> {
  return request('/api/follow-ups/evaluate', {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  });
}

// ======================== ANALYTICS ========================

export interface AnalyticsBucket {
  bucket: string;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate?: number | null;
}

export interface AnalyticsOverview {
  filters: { from: string; to: string; classId: string | null };
  totals: {
    students: number;
    activeClasses: number;
    attendanceSessions: number;
    childrenWithAttendance: number;
    recordedRecords: number;
    attendanceRate: number | null;
  };
  distribution: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  };
  weekly: AnalyticsBucket[];
  monthly: AnalyticsBucket[];
  classes: Array<{
    id: string;
    name: string;
    grade: string;
    students: number;
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    openFollowUps: number;
    rate: number | null;
  }>;
  followUps: {
    openCases: number;
    inProgressCases: number;
    overdueCases: number;
    assignedCases: number;
    unassignedCases: number;
    resolvedInRange: number;
    childrenWithOpenCases: number;
    activitiesInRange: number;
    workload: number;
  };
}

export async function getAnalyticsOverview(paramsObj?: {
  from?: string;
  to?: string;
  classId?: string;
}): Promise<AnalyticsOverview> {
  const params = new URLSearchParams();
  if (paramsObj?.from) params.append('from', paramsObj.from);
  if (paramsObj?.to) params.append('to', paramsObj.to);
  if (paramsObj?.classId) params.append('classId', paramsObj.classId);
  return request(`/api/analytics/overview?${params.toString()}`, { cache: 'no-store' });
}

// ======================== ATTENDANCE REPORTS & SESSIONS ========================

export interface AttendanceReport {
  range: { from: string; to: string };
  totals: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    students: number;
    rate: number | null;
  };
  weekly: AnalyticsBucket[];
  monthly: AnalyticsBucket[];
  classes: Array<{
    id: string;
    name: string;
    grade: string;
    students: number;
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    rate: number | null;
  }>;
}

export async function getAttendanceReport(paramsObj?: {
  from?: string;
  to?: string;
  classId?: string;
}): Promise<AttendanceReport> {
  const params = new URLSearchParams();
  if (paramsObj?.from) params.append('from', paramsObj.from);
  if (paramsObj?.to) params.append('to', paramsObj.to);
  if (paramsObj?.classId) params.append('classId', paramsObj.classId);
  return request(`/api/attendance/report?${params.toString()}`, { cache: 'no-store' });
}

export interface AttendanceSession {
  id: string;
  classId: string;
  date: string;
  notes: string | null;
  className: string | null;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  rate?: number | null;
  recordedBy: string | null;
  createdAt: string;
}

export async function getAttendanceSessions(paramsObj?: {
  classId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}): Promise<{ data: AttendanceSession[]; meta: { total: number } }> {
  const params = new URLSearchParams();
  if (paramsObj?.classId) params.append('classId', paramsObj.classId);
  if (paramsObj?.dateFrom) params.append('dateFrom', paramsObj.dateFrom);
  if (paramsObj?.dateTo) params.append('dateTo', paramsObj.dateTo);
  if (paramsObj?.limit) params.append('limit', String(paramsObj.limit));
  return request(`/api/attendance/sessions?${params.toString()}`, { cache: 'no-store' });
}

export async function createAttendanceSession(data: {
  classId: string;
  date: string;
  notes?: string;
}): Promise<{ id: string; classId: string; date: string; notes: string | null }> {
  return request('/api/attendance/sessions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ======================== NOTIFICATIONS ========================

export interface AppNotification {
  id: string;
  type: 'follow_up_assigned' | 'follow_up_overdue' | 'follow_up_completed' | 'attendance_alert';
  title: string;
  body: string | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function getNotifications(paramsObj?: {
  unread?: boolean;
  limit?: number;
}): Promise<{ data: AppNotification[]; meta: { total: number; unread: number; limit: number } }> {
  const params = new URLSearchParams();
  if (paramsObj?.unread) params.append('unread', 'true');
  if (paramsObj?.limit) params.append('limit', String(paramsObj.limit));
  return request(`/api/notifications?${params.toString()}`, { cache: 'no-store' });
}

export async function markNotificationsRead(data: {
  ids?: string[];
  all?: boolean;
  read?: boolean;
}): Promise<{ message: string }> {
  return request('/api/notifications', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export interface NotificationPreferences {
  followUpAssigned: boolean;
  followUpOverdue: boolean;
  followUpCompleted: boolean;
  attendanceAlert: boolean;
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return request('/api/notifications/preferences', { cache: 'no-store' });
}

export async function updateNotificationPreferences(
  data: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  return request('/api/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
