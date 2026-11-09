export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiList<T> {
  data: T[];
}
export interface ApiItem<T> {
  data: T;
}

export interface HealthResponse {
  status: "ok";
  service: "reel-engine-api";
  time: string;
}
