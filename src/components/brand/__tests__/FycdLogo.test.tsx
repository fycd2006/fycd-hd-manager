/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { FycdLogo } from '../FycdLogo'

describe('FycdLogo', () => {
  it('renders full variant with fycd, hd and fold parts', () => {
    const { container } = render(<FycdLogo />)
    expect(screen.getByRole('img', { name: 'FYCD HD' })).toBeInTheDocument()
    expect(container.querySelector('[data-part="fycd"]')).not.toBeNull()
    expect(container.querySelector('[data-part="hd"]')).not.toBeNull()
    expect(container.querySelector('[data-part="fold"]')).not.toBeNull()
  })

  it('icon variant omits the FYCD wordmark', () => {
    const { container } = render(<FycdLogo variant="icon" />)
    expect(container.querySelector('[data-part="fycd"]')).toBeNull()
    expect(container.querySelector('svg')).toHaveAttribute('viewBox', '400 -30 312 136')
  })

  it('mono tone renders no fold layer', () => {
    const { container } = render(<FycdLogo tone="mono" />)
    expect(container.querySelector('[data-part="fold"]')).toBeNull()
  })

  it('gradient ids are unique per instance', () => {
    const { container } = render(
      <>
        <FycdLogo />
        <FycdLogo />
      </>
    )
    const ids = Array.from(container.querySelectorAll('linearGradient')).map(el => el.id)
    expect(ids.length).toBe(2)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('animation classes only when animated', () => {
    const { container, rerender } = render(<FycdLogo animated />)
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('animated')
    rerender(<FycdLogo />)
    expect(container.querySelector('svg')!.getAttribute('class') ?? '').not.toContain('animated')
  })
})
