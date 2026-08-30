export function json(body, status = 200) {
  return {
    status,
    jsonBody: body,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  };
}

export function badRequest(message) {
  return json({ error: message }, 400);
}

export function notFound(message = 'Nicht gefunden') {
  return json({ error: message }, 404);
}

export function forbidden(message = 'Keine Berechtigung') {
  return json({ error: message }, 403);
}

export function serverError(error, context) {
  context?.error?.(error);
  const status = Number(error.status || 500);
  return json({ error: error.message || 'Internal server error' }, status >= 400 && status < 600 ? status : 500);
}
