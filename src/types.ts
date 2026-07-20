/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transaction {
  id: string;
  name: string;
  date: string;
  time: string;
  amount: number;
  type: 'debit' | 'credit';
  status: 'Pending' | 'Completed' | 'Failed';
  category: string;
}

export interface UserProfile {
  surname: string;
  middleName: string;
  lastName: string;
  username: string;
  email: string;
  pin: string;
  dob: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  balance: number;
  savingsBalance?: number;
  gender: string;
  occupation: string;
  address: string;
  accountNumber: string;
  branchCode: string;
  password?: string;
}

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
}
