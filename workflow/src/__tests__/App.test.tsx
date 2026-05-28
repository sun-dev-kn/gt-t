import { render, screen } from '@testing-library/react';
import App from '../App';

test('renders the workflow designer layout', () => {
  render(<App />);
  expect(screen.getByTestId('wf-app')).toBeInTheDocument();
});
