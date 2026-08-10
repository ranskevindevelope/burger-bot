class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

const parseResponse = async (response) => {
  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) return await response.json();
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  } catch (error) {
    return null;
  }
};

export const createApiClient = (onUnauthorized) => {
  const request = async (url, options = {}) => {
    const token = localStorage.getItem('fp_token');
    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    };
    const response = await fetch(url, { ...options, headers });
    const body = await parseResponse(response);

    if (response.status === 401) {
      onUnauthorized();
      throw new ApiError('Sesión expirada', response.status, body);
    }

    if (!response.ok) {
      const message = body && typeof body === 'object'
        ? body.error || body.message
        : null;
      throw new ApiError(message || `Error de solicitud (${response.status})`, response.status, body);
    }

    return body;
  };

  const download = async (url, options = {}) => {
    const token = localStorage.getItem('fp_token');
    const headers = {
      ...(options.headers || {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    };
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401) {
      onUnauthorized();
      throw new ApiError('Sesión expirada', response.status);
    }
    if (!response.ok) {
      const body = await parseResponse(response);
      const message = body && typeof body === 'object'
        ? body.error || body.message
        : null;
      throw new ApiError(message || `Error de descarga (${response.status})`, response.status, body);
    }

    return response.blob();
  };

  return { request, download };
};
