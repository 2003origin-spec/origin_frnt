---
title: "Wave Optics: Formula Sheet"
type: formula_sheet
chapter: c12.physics.wave-optics
order: 1
---

Symbols follow NCERT: $n$ = refractive index (some books write $\mu$), $\nu$ = frequency, $\phi$ = phase difference, $c = 3.0 \times 10^8$ m/s.

## Refraction and reflection (Huygens)

:::formula{title="Refractive index"}
$$n = \frac{c}{v}$$
$v$ = speed of light in the medium (m/s). $n$ has no unit.
:::

:::formula{title="Snell's law from Huygens' construction"}
$$\frac{\sin i}{\sin r} = \frac{v_1}{v_2}$$
$$n_1 \sin i = n_2 \sin r$$
$i$ = angle of incidence in medium 1, $r$ = angle of refraction in medium 2. If $r < i$ (bends towards the normal), then $v_2 < v_1$.
:::

:::formula{title="Speed and wavelength in two media"}
$$\frac{v_1}{\lambda_1} = \frac{v_2}{\lambda_2}$$
Both ratios equal the frequency $\nu$, which does **not** change on refraction or reflection. Only $v$ and $\lambda$ change.
:::

:::formula{title="Wavelength in a medium"}
$$\lambda_{medium} = \frac{\lambda}{n}$$
$\lambda$ = wavelength in vacuum (or air). Follows from $v = c/n$ with $\nu$ fixed.
:::

:::formula{title="Critical angle"}
$$\sin i_c = \frac{n_2}{n_1}$$
Only when light goes from a denser to a rarer medium ($n_1 > n_2$). For $i > i_c$ there is no refracted wave: total internal reflection.
:::

## Superposition of two waves

:::formula{title="Phase difference and path difference"}
$$\phi = \frac{2\pi}{\lambda}\,\Delta$$
$\Delta$ = path difference. A path difference of $\lambda$ means a phase difference of $2\pi$.
:::

:::formula{title="Constructive interference (bright)"}
$$\Delta = n\lambda$$
$$\phi = 0, \pm 2\pi, \pm 4\pi, \dots$$
$n = 0, 1, 2, \dots$ For two coherent sources in phase.
:::

:::formula{title="Destructive interference (dark)"}
$$\Delta = \left(n + \tfrac12\right)\lambda$$
$$\phi = \pm\pi, \pm 3\pi, \pm 5\pi, \dots$$
$n = 0, 1, 2, \dots$
:::

:::formula{title="Intensity: two equal coherent sources"}
$$I = 4I_0\cos^2\frac{\phi}{2}$$
$I_0$ = intensity from each source alone ($I_0 \propto a^2$). Maximum $4I_0$, minimum $0$.
:::

:::formula{title="Intensity: two incoherent sources"}
$$I = 2I_0$$
The phase difference changes very fast, so only the time average is seen: the intensities just add, at every point. No fringes.
:::

:::formula{title="Unequal sources (exam extra, not in NCERT)"}
$$I = I_1 + I_2 + 2\sqrt{I_1 I_2}\cos\phi$$
$$I_{max} = \left(\sqrt{I_1} + \sqrt{I_2}\right)^2$$
$$I_{min} = \left(\sqrt{I_1} - \sqrt{I_2}\right)^2$$
Since $I \propto a^2$, $\sqrt{I_1} : \sqrt{I_2} = a_1 : a_2$. With $I_1 = I_2 = I_0$ this gives NCERT's $4I_0\cos^2(\phi/2)$.
:::

## Young's double-slit experiment (YDSE)

$d$ = distance between the slits, $D$ = distance from slits to screen, $x$ = distance of a point on the screen from the centre O.

:::formula{title="Path difference at a point x"}
$$S_2P - S_1P \approx \frac{x\,d}{D}$$
Valid when $D \gg d$ and $x \ll D$.
:::

:::formula{title="Bright fringes"}
$$x_n = \frac{n\lambda D}{d}$$
$n = 0, \pm 1, \pm 2, \dots$ The centre ($n = 0$) is bright.
:::

:::formula{title="Dark fringes"}
$$x_n = \left(n + \tfrac12\right)\frac{\lambda D}{d}$$
$n = 0, \pm 1, \pm 2, \dots$ The first dark fringe is at half a fringe width ($\beta/2$, below) from the centre.
:::

:::formula{title="Fringe width"}
$$\beta = \frac{\lambda D}{d}$$
Distance between two neighbouring bright (or dark) fringes, in metres. NCERT gives the fringe positions above and says the fringes are equally spaced; this spacing is the "fringe width" both exam syllabi ask for.
:::

:::formula{title="Angular fringe width (derived)"}
$$\theta = \frac{\lambda}{d}$$
It equals $\beta/D$, in radians. Small angles only. Does not depend on $D$.
:::

:::formula{title="YDSE inside a liquid (derived)"}
$$\beta' = \frac{\beta}{n}$$
The whole set-up is in a medium of refractive index $n$, so $\lambda$ becomes $\lambda/n$.
:::

:::formula{title="Thin sheet over one slit (exam extra, not in NCERT)"}
$$\Delta x = \frac{(n - 1)\,t\,D}{d}$$
$t$ = sheet thickness, $n$ = its refractive index. The whole pattern shifts **towards the covered slit**; $\beta$ does not change.
:::

## Single-slit diffraction

$a$ = slit width, $\theta$ = angle from the central line, parallel light falling normally on the slit.

:::formula{title="Minima (zero intensity)"}
$$\theta \approx \frac{n\lambda}{a}$$
$n = \pm 1, \pm 2, \pm 3, \dots$ (never $n = 0$: the centre is the brightest point). The exact condition is $a\sin\theta = n\lambda$; NCERT's form uses $\sin\theta \approx \theta$ (small angles).
:::

:::formula{title="Secondary maxima"}
$$\theta \approx \left(n + \tfrac12\right)\frac{\lambda}{a}$$
$n = \pm 1, \pm 2, \dots$ They get weaker and weaker as $|n|$ grows. These positions are approximate.
:::

:::formula{title="Width of the central maximum"}
$$\text{Angular width} = \frac{2\lambda}{a}$$
$$\text{Linear width} = \frac{2\lambda D}{a}$$
$D$ = slit-to-screen distance (use the focal length $f$ if a lens focuses the pattern). It is twice the width of each secondary maximum.
:::

## Polarisation

:::formula{title="A plane polarised wave"}
$$y(x,t) = a\sin(kx - \omega t)$$
$$k = \frac{2\pi}{\lambda}$$
$$\omega = 2\pi\nu$$
$a$ = amplitude. The displacement ($y$) is at right angles to the direction of travel ($x$): a transverse, $y$-polarised wave.
:::

:::formula{title="Unpolarised light through one polaroid"}
$$I = \frac{I_{unpol}}{2}$$
The same for every orientation of the polaroid.
:::

:::formula{title="Malus' law"}
$$I = I_0\cos^2\theta$$
$I_0$ = intensity of the polarised light after the first polaroid, $\theta$ = angle between the **pass axes** of the two polaroids.
:::

:::formula{title="Third polaroid between crossed polaroids (NCERT Example 10.2)"}
$$I = I_0\cos^2\theta\,\sin^2\theta$$
$$I = \frac{I_0}{4}\sin^2 2\theta$$
$I_0$ = intensity after the first polaroid, $\theta$ = angle between the first and the middle polaroid. Maximum ($I_0/4$) at $\theta = 45^\circ$.
:::

:::formula{title="Brewster's law (exam extra: in the JEE Main and NEET syllabi, not in NCERT)"}
$$\tan i_B = n$$
$n$ = refractive index of the reflecting medium relative to the first ($n_2/n_1$). At $i_B$ the reflected light is fully plane polarised, and the reflected and refracted rays are at $90^\circ$: $i_B + r = 90^\circ$.
:::
