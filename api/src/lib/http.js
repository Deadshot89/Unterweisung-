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

export function serverError(error, context) {
  context?.error?.(error);
  return json({ error: error.message || 'Internal server error' }, 500);
}
