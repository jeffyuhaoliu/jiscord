import { apiLogin, apiRegister, LoginResponse } from "./api";

let counter = 0;

export interface CreatedUser extends LoginResponse {
  password: string;
}

export async function createUser(prefix = "user"): Promise<CreatedUser> {
  const id = `${Date.now()}-${counter++}`;
  const username = `${prefix}${id}`.slice(0, 32);
  const email = `${prefix}${id}@e2e.test`;
  const password = `password-${id}`;

  await apiRegister(username, email, password);
  const loginData = await apiLogin(email, password);

  return { ...loginData, password };
}
