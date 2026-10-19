'use client';

/**
 * Delivery address for a merch order (decision B91). The server checks it
 * again (store-rules validateDeliveryAddress); this form only helps fill it.
 */

const STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

export type AddressDraft = { name: string; phone: string; line1: string; line2: string; city: string; state: string; pincode: string };
export const emptyAddress: AddressDraft = { name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

const input = 'w-full rounded-md border bg-background px-2 py-1.5 text-sm';

export function NowAddressForm({ idPrefix, value, onChange }: { idPrefix: string; value: AddressDraft; onChange: (next: AddressDraft) => void }) {
  const field = (key: keyof AddressDraft, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label htmlFor={`${idPrefix}-${key}`} className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input id={`${idPrefix}-${key}`} className={input} value={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.value })} {...extra} />
    </label>
  );
  return (
    <fieldset className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
      <legend className="px-1 text-xs font-medium">Deliver to</legend>
      {field('name', 'Name', { autoComplete: 'name', maxLength: 80 })}
      {field('phone', 'Mobile (for the courier)', { autoComplete: 'tel', inputMode: 'tel', maxLength: 16 })}
      <div className="sm:col-span-2">{field('line1', 'House, street and area', { autoComplete: 'address-line1', maxLength: 120 })}</div>
      <div className="sm:col-span-2">{field('line2', 'Landmark (optional)', { autoComplete: 'address-line2', maxLength: 120 })}</div>
      {field('city', 'Town or city', { autoComplete: 'address-level2', maxLength: 60 })}
      {field('pincode', 'PIN code', { autoComplete: 'postal-code', inputMode: 'numeric', maxLength: 6 })}
      <label htmlFor={`${idPrefix}-state`} className="flex flex-col gap-1 text-xs sm:col-span-2">
        <span className="text-muted-foreground">State</span>
        <select id={`${idPrefix}-state`} className={input} value={value.state} onChange={(e) => onChange({ ...value, state: e.target.value })}>
          <option value="">Pick the state</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[11px] text-muted-foreground sm:col-span-2">
        Used only to deliver this order, and deleted 90 days after it arrives. India only.
      </p>
    </fieldset>
  );
}
