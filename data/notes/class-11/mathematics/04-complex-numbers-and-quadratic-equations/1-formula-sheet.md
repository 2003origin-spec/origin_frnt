---
title: "Complex Numbers: Formula Sheet"
type: formula_sheet
chapter: c11.mathematics.complex-numbers-and-quadratic-equations
order: 1
---

## The number i

:::formula{title="Definition of i"}
$$i = \sqrt{-1}$$
$$i^2 = -1$$
$i$ is a solution of $x^2 + 1 = 0$. The other solution is $-i$.
:::

:::formula{title="Powers of i"}
For any integer $k$ (positive, negative or zero):
$$i^{4k} = 1$$
$$i^{4k+1} = i$$
$$i^{4k+2} = -1$$
$$i^{4k+3} = -i$$
Also $i^{-1} = -i$. Any four consecutive powers add up to 0:
$$i^n + i^{n+1} + i^{n+2} + i^{n+3} = 0$$
:::

## Complex number and equality

:::formula{title="Standard form"}
$$z = a + ib$$
$a, b$ real. Real part $\text{Re}\,z = a$. Imaginary part $\text{Im}\,z = b$ (a real number, not $ib$).
:::

:::formula{title="Equality"}
$$a + ib = c + id$$
holds exactly when $a = c$ and $b = d$. Only when $a, b, c, d$ are all real.
:::

## Operations

Let $z_1 = a + ib$ and $z_2 = c + id$.

:::formula{title="Sum and difference"}
$$z_1 + z_2 = (a + c) + i(b + d)$$
$$z_1 - z_2 = (a - c) + i(b - d)$$
Additive identity $0 = 0 + i0$. Additive inverse $-z = -a + i(-b)$.
:::

:::formula{title="Product"}
$$z_1 z_2 = (ac - bd) + i(ad + bc)$$
Multiplicative identity $1 = 1 + i0$.
:::

:::formula{title="Multiplicative inverse"}
$$z^{-1} = \frac{a}{a^2 + b^2} + i\,\frac{-b}{a^2 + b^2}$$
$$z^{-1} = \frac{\bar z}{|z|^2}$$
Exists for every $z = a + ib \ne 0$, that is, $a$ and $b$ not both zero.
:::

:::formula{title="Quotient"}
$$\frac{z_1}{z_2} = z_1 \cdot \frac{1}{z_2}$$
Defined only for $z_2 \ne 0$. In practice, multiply top and bottom by $\bar z_2$:
$$\frac{a + ib}{c + id} = \frac{(a + ib)(c - id)}{c^2 + d^2}$$
:::

:::formula{title="Identities"}
These real-number identities also hold for complex $z_1, z_2$:
$$(z_1 + z_2)^2 = z_1^2 + 2z_1 z_2 + z_2^2$$
$$(z_1 - z_2)^2 = z_1^2 - 2z_1 z_2 + z_2^2$$
$$z_1^2 - z_2^2 = (z_1 + z_2)(z_1 - z_2)$$
The cube identities $(z_1 \pm z_2)^3$ hold too.
:::

## Square roots of negative numbers

:::formula{title="Square root of a negative number"}
For a real number $a > 0$:
$$\sqrt{-a} = \sqrt{a}\,i$$
The square roots of $-a$ are $\pm\sqrt{a}\,i$, but the symbol $\sqrt{-a}$ means $\sqrt{a}\,i$ only.
:::

:::formula{title="Product of square roots"}
$$\sqrt{a}\,\sqrt{b} = \sqrt{ab}$$
For real $a, b$: true unless $a$ and $b$ are **both negative**. Then
$$\sqrt{a}\,\sqrt{b} = -\sqrt{ab}$$
:::

## Modulus and conjugate

:::formula{title="Modulus and conjugate"}
For $z = a + ib$:
$$|z| = \sqrt{a^2 + b^2}$$
$$\bar z = a - ib$$
$|z|$ is a non-negative real number.
:::

:::formula{title="Key results"}
$$z\,\bar z = |z|^2$$
$$z + \bar z = 2\,\text{Re}\,z$$
$$z - \bar z = 2i\,\text{Im}\,z$$
$$|\bar z| = |z|$$
$$|-z| = |z|$$
:::

:::formula{title="Products and quotients"}
$$|z_1 z_2| = |z_1|\,|z_2|$$
$$\left|\frac{z_1}{z_2}\right| = \frac{|z_1|}{|z_2|}$$
$$\overline{z_1 z_2} = \bar z_1\,\bar z_2$$
$$\overline{z_1 \pm z_2} = \bar z_1 \pm \bar z_2$$
$$\overline{\left(\frac{z_1}{z_2}\right)} = \frac{\bar z_1}{\bar z_2}$$
The quotient rules need $z_2 \ne 0$.
:::

## Argand plane

:::formula{title="Point and distance"}
$z = x + iy$ is the point $P(x, y)$. $\bar z$ is $(x, -y)$, the mirror image of $P$ in the real axis.
$$|z| = OP = \sqrt{x^2 + y^2}$$
(Exam extra) The distance between the points $z_1$ and $z_2$ is $|z_1 - z_2|$.
:::

## Exam extras (in the JEE Main syllabus, not in the current NCERT text)

:::formula{title="Polar form"}
$$z = r(\cos\theta + i\sin\theta)$$
$r = |z|$. $\theta = \arg z$, with $\cos\theta = \dfrac{a}{r}$ and $\sin\theta = \dfrac{b}{r}$ ($z \ne 0$). Principal argument: $-\pi < \theta \le \pi$.
:::

:::formula{title="Argument rules"}
$$\arg(z_1 z_2) = \arg z_1 + \arg z_2$$
$$\arg\frac{z_1}{z_2} = \arg z_1 - \arg z_2$$
For $z_1, z_2 \ne 0$. Both up to adding $2k\pi$ (to bring the answer back into $(-\pi, \pi]$).
:::

:::formula{title="Triangle inequality"}
$$|z_1 + z_2| \le |z_1| + |z_2|$$
$$\big||z_1| - |z_2|\big| \le |z_1 - z_2|$$
:::

:::formula{title="Modulus of a sum"}
$$\begin{aligned} |z_1 + z_2|^2 &= |z_1|^2 + |z_2|^2 \\ &\quad + 2\,\text{Re}(z_1 \bar z_2) \end{aligned}$$
:::

:::formula{title="Quadratic with real coefficients"}
For $ax^2 + bx + c = 0$ with $a, b, c$ real, $a \ne 0$, and $D = b^2 - 4ac$:
$$x = \frac{-b \pm \sqrt{D}}{2a}$$
If $D < 0$:
$$x = \frac{-b \pm i\sqrt{-D}}{2a}$$
These two roots are conjugates of each other.
:::

:::formula{title="Sum and product of roots"}
$$\alpha + \beta = -\frac{b}{a}$$
$$\alpha\beta = \frac{c}{a}$$
Equation with roots $\alpha, \beta$:
$$x^2 - (\alpha + \beta)x + \alpha\beta = 0$$
:::

:::formula{title="Cube roots of unity"}
$$\omega = \frac{-1 + i\sqrt3}{2}$$
$$\omega^3 = 1$$
$$1 + \omega + \omega^2 = 0$$
The cube roots of 1 are $1, \omega, \omega^2$. Also $\bar\omega = \omega^2$ and $|\omega| = 1$.
:::
