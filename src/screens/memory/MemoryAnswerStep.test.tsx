import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { emptyMemoryDraft, type MemoryDraft, type MemoryRecallTask } from '../../types/memory';
import { MemoryAnswerStep } from './MemoryAnswerStep';

const appointment: MemoryRecallTask = {
  id: 'mr-test-appt',
  type: 'memory_recall',
  contentVersion: 1,
  difficulty: 2,
  category: 'appointment',
  instruction: 'Iegaumē, kad, cikos un kur.',
  stimulus: {
    visualText: 'Pirmdien\nplkst. 09:00\npie zobārsta',
    ttsSegments: ['Pirmdien', 'pulksten 09:00', 'pie zobārsta'],
    locale: 'lv-LV',
  },
  answer: {
    kind: 'facts',
    freeInput: 'fact_fields',
    fields: [
      {
        key: 'day',
        prompt: 'Kad?',
        acceptedAnswers: ['Pirmdien'],
        recognition: {
          type: 'single_select',
          options: ['Otrdien', 'Pirmdien'],
          correctIndex: 1,
        },
      },
      {
        key: 'time',
        prompt: 'Cikos?',
        acceptedAnswers: ['09:00'],
        recognition: {
          type: 'single_select',
          options: ['09:00', '10:00'],
          correctIndex: 0,
        },
      },
      {
        key: 'place',
        prompt: 'Kur?',
        acceptedAnswers: ['pie zobārsta'],
        recognition: {
          type: 'single_select',
          options: ['bibliotēkā', 'pie zobārsta'],
          correctIndex: 1,
        },
      },
    ],
  },
};

function Harness() {
  const [draft, setDraft] = useState<MemoryDraft>(emptyMemoryDraft());
  return (
    <MemoryAnswerStep
      task={appointment}
      draft={draft}
      onDraft={(recipe) => setDraft((current) => recipe(current))}
      onRecord={() => true}
      onAdvance={() => undefined}
      onSkip={() => undefined}
    />
  );
}

afterEach(() => {
  cleanup();
});

describe('memory appointment answers', () => {
  it('shows the expected answers after Pārbaudīt on the first recall', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Kad?'), { target: { value: 'Otrdien' } });
    fireEvent.change(screen.getByLabelText('Cikos?'), { target: { value: '10:00' } });
    const place = screen.getByLabelText('Kur?');
    fireEvent.change(place, { target: { value: 'bibliotēkā' } });
    fireEvent.focus(place);
    fireEvent.click(screen.getByRole('button', { name: 'Pārbaudīt atbildi' }));

    expect(screen.getByText(/Pirmdien/)).toBeTruthy();
    expect(screen.getByText(/09:00/)).toBeTruthy();
    expect(screen.getByText(/pie zobārsta/)).toBeTruthy();
  });
});
