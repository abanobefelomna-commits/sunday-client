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
  avatar?: string | null;
}

export interface ClassItem {
  id: string;
  name: string;
  grade: string;
  academicYear: string;
  image?: string | null;
  leadServantId?: string | null;
  leadServant?: {
    id: string;
    name: string;
  } | null;
  servants?: Array<{
    id: string;
    name: string;
    phone: string;
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
  const res = await fetch(url, {
    ...options,
    headers,
  });

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
  role?: string;
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

export async function getClasses(search?: string): Promise<ClassItem[]> {
  const params = new URLSearchParams();
  if (search && search.trim()) params.append('search', search.trim());
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
  grade: string;
  academicYear: string;
}): Promise<ClassItem> {
  return request('/api/classes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateClass(
  id: string,
  data: Partial<{ name: string; grade: string; academicYear: string }>,
): Promise<ClassItem> {
  return request(`/api/classes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
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
  parentPhone: string;
  address?: string;
  parentName?: string;
  notes?: string;
  classId?: string;
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
  records: Array<{
    childId: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    notes?: string;
  }>;
}): Promise<{ count: number }> {
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
