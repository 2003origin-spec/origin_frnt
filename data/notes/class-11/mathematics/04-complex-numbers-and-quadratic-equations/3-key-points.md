---
title: "Complex Numbers: Important Points and Traps"
type: key_points
chapter: c11.mathematics.complex-numbers-and-quadratic-equations
order: 3
---

## NCERT one-liners

:::remember
- $\text{Im}(a + ib) = b$, a **real** number. It is not $ib$.
- The square roots of $-1$ are $i$ and $-i$, but $\sqrt{-1}$ means $i$ only.
- The plane with a complex number at each point is the **complex plane** or **Argand plane**. Its x-axis is the real axis and its y-axis is the imaginary axis.
- $|z|$ is the distance of the point $z$ from the origin.
- $\bar z$ is the mirror image of $z$ in the real axis.
- **Euler** first used the symbol $i$ for $\sqrt{-1}$. **W. R. Hamilton** treated $a + ib$ as an ordered pair $(a, b)$ of real numbers.
- **Mahavira** (850) first clearly stated that a negative number has no square root, in *Ganitasara Sangraha*.
:::

## Square roots

:::trap
$\sqrt{a}\,\sqrt{b} = \sqrt{ab}$ is **false** when $a$ and $b$ are both negative.

$\sqrt{-4}\,\sqrt{-9} = (2i)(3i) = 6i^2 = -6$, not $\sqrt{36} = 6$.

Always change $\sqrt{-a}$ to $\sqrt{a}\,i$ **first**, then multiply.
:::

:::trap
The rule is still fine when only **one** of them is negative: $\sqrt{-4}\,\sqrt{9} = 2i \times 3 = 6i = \sqrt{-36}$.
:::

## Powers of i

:::trap
$i^{-1} = -i$, not $i$. Check: $i \times (-i) = -i^2 = 1$.
:::

- For $i^n$, only $n \bmod 4$ matters. For a negative $n$, add a multiple of 4 first: $i^{-35} = i^{-36} \cdot i = i$.
- Any four consecutive powers add to 0. So $i + i^2 + \cdots + i^{100} = 0$ (25 full blocks).

:::tip
Learn these, they save time:
- $(1 + i)^2 = 2i$ and $(1 - i)^2 = -2i$.
- $\dfrac{1 + i}{1 - i} = i$ and $\dfrac{1 - i}{1 + i} = -i$.
- So $(1 + i)^4 = -4$ and $(1 - i)^4 = -4$.
:::

## Equality and order

:::trap
You may equate real and imaginary parts **only when the unknowns are real**. If $x$ could be complex, $x + iy = 2 + 3i$ does not force $x = 2$.
:::

- One complex equation gives two real equations. Use both.
- There is no "greater than" between non-real complex numbers. $2 + i > 1 + i$ has no meaning. Only moduli, real parts or imaginary parts can be compared.

## Inverse and division

:::trap
NCERT writes the inverse with "$a \ne 0, b \ne 0$". Read it as "$a$ and $b$ **not both** zero", that is, $z \ne 0$. For example, $-i$ (with $a = 0$) has inverse $i$.
:::

- To divide, multiply top and bottom by the conjugate of the **bottom**, not of the top.
- Final answers must be in the form $a + ib$: no $i$ in the denominator.

## Modulus and conjugate

:::trap
$|z_1 + z_2| \ne |z_1| + |z_2|$ in general. The modulus splits over **products and quotients only**. For sums there is only the triangle inequality $|z_1 + z_2| \le |z_1| + |z_2|$ (exam extra).
:::

:::trap
The conjugate changes the sign of the **imaginary part only**. $\overline{-5 - 3i} = -5 + 3i$, not $5 + 3i$.
:::

- $|z|^2 = z\bar z$, but $|z|^2 \ne z^2$ unless $z$ is real. For $z = i$: $|z|^2 = 1$, $z^2 = -1$.
- $|z| = |\bar z| = |-z| = |-\bar z|$.
- If $|z| = 1$, then $\bar z = \dfrac1z$. Very useful in JEE problems.
- $z$ is real $\iff z = \bar z$. $\text{Re}\,z = 0 \iff z = -\bar z$.

:::tip
To find the modulus of a big product or quotient, **do not expand**. Take the modulus of each factor:
$$\left|\frac{(3 + 4i)^2}{1 - i}\right| = \frac{5^2}{\sqrt2}$$
:::

## Argument (exam extra)

:::trap
$\tan^{-1}\dfrac{b}{a}$ alone gives the wrong angle in quadrants II and III. Draw the point, find the acute angle, then place it in the right quadrant.

$\arg(-1 - i) = -\dfrac{3\pi}{4}$, not $\dfrac{\pi}{4}$.
:::

- Principal argument lies in $(-\pi, \pi]$. A negative real number has argument $\pi$. $\arg 0$ is not defined.
- $\arg(z_1 z_2) = \arg z_1 + \arg z_2$ may need $\pm 2\pi$ to stay in $(-\pi, \pi]$.

## Quadratic equations (exam extra)

:::trap
Non-real roots come in **conjugate pairs only when the coefficients are real**. With complex coefficients this fails: $x^2 + ix + 2 = 0$ has roots $i$ and $-2i$.
:::

:::trap
With real coefficients, "real roots" means $D \ge 0$. "Two distinct real roots" means $D > 0$. Read which one the question asks for.
:::

- If $a, b, c$ are real and $2 + 3i$ is a root, then $2 - 3i$ is the other root. With leading coefficient 1, the equation is $x^2 - 4x + 13 = 0$.

:::tip
For $1 + \omega + \omega^2 = 0$ problems: reduce every power of $\omega$ using $\omega^3 = 1$, then replace $1 + \omega$ by $-\omega^2$ (or $1 + \omega^2$ by $-\omega$).
:::
