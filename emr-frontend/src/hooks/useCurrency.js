// src/hooks/useCurrency.js
import { useTenant } from '../context/TenantContext';

export const useCurrency = () => {
  const { currencySymbol } = useTenant();

  const format = (amount) => {
    if (amount === null || amount === undefined) return `${currencySymbol}0`;
    return `${currencySymbol}${Number(amount).toLocaleString()}`;
  };

  return { format, symbol: currencySymbol };
};