

# Subtler Contact Us Glow

## What Changes

Adjust the `contact-glow` CSS animation in `src/styles/navigation.css`:

- **Duration**: 3s --> 5s (slower, calmer breathing rhythm)
- **Glow intensity**: Reduce `box-shadow` spread from `14px 5px` to `8px 3px` and opacity from `0.35` to `0.2`
- **Remove scale**: Drop `transform: scale(1.03)` so the button doesn't physically grow -- just a soft light pulse
- **Easing**: Keep `ease-in-out` for smooth transitions

### Updated CSS

```css
@keyframes contact-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(249, 115, 22, 0);
  }
  50% {
    box-shadow: 0 0 8px 3px rgba(249, 115, 22, 0.2);
  }
}

.contact-glow {
  animation: contact-glow 5s ease-in-out infinite;
  /* rest unchanged */
}
```

Only one file touched: `src/styles/navigation.css` (lines 115-126).

