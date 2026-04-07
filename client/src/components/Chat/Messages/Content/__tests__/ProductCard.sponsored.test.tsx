import { render, screen } from '@testing-library/react';
import ProductCard from '../ProductCard';

const baseProduct = JSON.stringify({
  name: 'Test Blender',
  price: '$99',
  storeName: 'TestStore',
  buyUrl: 'https://example.com',
  rating: 4.5,
  reviewCount: 100,
});

describe('ProductCard sponsored prop', () => {
  it('does not show sponsored badge when sponsored is false', () => {
    render(<ProductCard text={baseProduct} sponsored={false} />);
    expect(screen.queryByText('Sponsored')).toBeNull();
  });

  it('shows sponsored badge when sponsored is true', () => {
    render(<ProductCard text={baseProduct} sponsored={true} />);
    expect(screen.getByText('Sponsored')).toBeInTheDocument();
  });
});
