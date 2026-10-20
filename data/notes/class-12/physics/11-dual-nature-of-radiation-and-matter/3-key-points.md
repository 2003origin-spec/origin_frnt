---
title: "Dual Nature: Important Points and Traps"
type: key_points
chapter: c12.physics.dual-nature-of-radiation-and-matter
order: 3
---

## What depends on what

| Quantity | Depends on | Not on |
| --- | --- | --- |
| Saturation current | Intensity, metal | Frequency, if photons per second are fixed (see trap) |
| Stopping potential $V_0$ | Frequency, metal | Intensity |
| $K_{max}$ | Frequency, metal | Intensity |
| Threshold $\nu_0$ | Metal (and its surface) | Light used |

:::trap
**Intensity does not change $V_0$ or $K_{max}$.** Brighter light gives **more** electrons per second, not **faster** ones. Only the frequency (and the metal) decides $K_{max}$.
:::

:::trap
**Below threshold, nothing.** If $\nu < \nu_0$, no electrons come out, however bright the light and however long it shines. Making it brighter does not help.
:::

:::trap
**$K_{max}$ is not proportional to $\nu$.** $K_{max} = h\nu - \phi_0$ is linear but does not pass through the origin. Doubling the frequency makes $K_{max}$ **more than** double.
:::

:::trap
**Same intensity, higher frequency.** NCERT (Fig. 11.4) draws the same saturation current for each frequency. But if the **power** of the beam is kept fixed, a higher frequency means fewer photons per second ($N = P/h\nu$), so fewer electrons and a smaller saturation current (taking each photon as equally likely to free an electron). Read what the question keeps constant.
:::

- $K_{max}$ is the energy of the **fastest** electrons only. Other photoelectrons come out slower: NCERT says the more tightly bound electrons emerge with less than $K_{max}$.
- At zero collector potential the photocurrent is **not zero**. The electrons leave with kinetic energy and some reach the collector anyway. It becomes zero only at $-V_0$.
- The stopping potential is the **size** of a negative potential on the collector. When a question says "stopping potential = 2 V", the collector is at $-2$ V relative to the emitter.

## Units

:::trap
Watch eV and joules. In $K_{max} = h\nu - \phi_0$, put **every term in the same unit**. With $h$ in J s, convert $\phi_0$ from eV to J (multiply by $1.6 \times 10^{-19}$).
:::

:::tip
**Energy in eV, potential in V:** $K_{max} = 1.7$ eV means $V_0 = 1.7$ V straight away. No conversion needed.
:::

:::tip
**The 1240 rule (a shortcut, not in NCERT):** photon energy in eV $\approx 1240 \div$ wavelength in nm. 620 nm gives 2 eV; 310 nm gives 4 eV; 248 nm gives 5 eV.
:::

## Graphs

- **$V_0$ against $\nu$:** straight line, slope $h/e$. Lines for different metals are **parallel**. The metal with the larger work function has its line further to the right (larger $\nu_0$).
- **$K_{max}$ against $\nu$:** straight line, slope $h$. Extended back, it meets the $K_{max}$-axis at $-\phi_0$.
- **Current against intensity:** straight line through the origin (for $\nu > \nu_0$).
- **Current against collector potential:** curves for different intensities meet at the same $-V_0$ and level off at different heights. Curves for different frequencies (same intensity, as in NCERT) level off at one height but cut the axis at different $-V_0$.

:::trap
Threshold **wavelength** $\lambda_0$ is the **longest** wavelength that works. Light with $\lambda > \lambda_0$ gives no emission. Frequency has a minimum; wavelength has a maximum.
:::

## Photons

- Photon energy $E = h\nu$ and momentum $p = E/c$. A photon always travels at $c$.
- Photons carry **no charge**, so fields don't bend them.
- In collisions, energy and momentum are conserved, but the **photon number is not**.
- More intense light of the same colour means **more photons**, each with the **same** energy.

:::remember
Points to ponder (NCERT): the photoelectric effect shows that light energy is **absorbed** in units of $h\nu$. NCERT notes that this alone is not quite the same as saying light is made of particles. Einstein's photon momentum $h\nu/c$ and Compton's experiment gave the particle picture its strength.
:::

## Matter waves

:::trap
$\lambda = h/p$ uses **momentum**, not kinetic energy. For the same kinetic energy, a heavier particle has a larger momentum, so a **shorter** wavelength: $\lambda \propto 1/\sqrt m$.
:::

- Same **momentum** (or same speed and mass) gives the same $\lambda$, whatever the charge.
- For the same accelerating voltage $V$ (exam extra): $\lambda \propto \dfrac{1}{\sqrt{mq}}$. An alpha particle has 4 times the mass and 2 times the charge of a proton, so $\lambda_p : \lambda_\alpha = 2\sqrt2 : 1$.
- Doubling the momentum halves $\lambda$. Making the kinetic energy 4 times halves $\lambda$ (as $\lambda \propto 1/\sqrt K$).
- Everyday objects have wavelengths far below anything measurable, so they show no wave behaviour.

:::trap
$\lambda = 1.227/\sqrt V$ nm is for an **electron** only, and only when it starts from rest and moves much slower than light. For a proton or alpha particle use $\lambda = h/\sqrt{2mqV}$.
:::

:::trap
For a **photon**, $E = pc$, so $\lambda = hc/E$. For a **slow particle**, $K = p^2/2m$, so $\lambda = h/\sqrt{2mK}$. Do not mix them: a photon and an electron with the same $\lambda$ have the same momentum but very different energies.
:::

## NCERT lines to know

:::remember
- Work function: the minimum energy needed by an electron to escape from the metal surface. It depends on the metal and the nature of its surface.
- Field emission needs fields of the order of $10^8$ V/m (spark plug).
- Photoelectric emission starts within about $10^{-9}$ s.
- Selenium is more sensitive than zinc or copper. Alkali metals respond to visible light; zinc, cadmium and magnesium need UV.
- Millikan tried to **disprove** Einstein's equation and ended up **confirming** it (1916).
- Nobel Prizes: Thomson 1906, Einstein 1921 (photoelectric effect), Millikan 1923, de Broglie 1929.
- The eye: focusing by the lens is wave behaviour; absorption by rods and cones needs the photon picture.
:::
