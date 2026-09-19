import { describe, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

describe('radix select smoke', () => {
  it('opens and shows options', async () => {
    render(
      <Select defaultValue="a">
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Alpha</SelectItem>
          <SelectItem value="b">Beta</SelectItem>
        </SelectContent>
      </Select>
    );
    const trigger = screen.getByRole('combobox');
    await userEvent.click(trigger);
    console.log('aria-expanded after click:', trigger.getAttribute('aria-expanded'));
    console.log('listbox present:', !!screen.queryByRole('listbox'));
    console.log('options:', screen.queryAllByRole('option').map(o => o.textContent));
  });
});
