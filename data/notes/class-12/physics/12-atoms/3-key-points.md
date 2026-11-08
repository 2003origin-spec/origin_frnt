---
title: "Atoms (Physics): Important Points and Traps"
type: key_points
chapter: c12.physics.atoms
order: 3
---

## Thomson vs Rutherford

| Point | Thomson | Rutherford |
| --- | --- | --- |
| Positive charge | Spread over the atom | In a tiny nucleus |
| Mass | Nearly continuous | Highly non-uniform |
| Electrons | Stable equilibrium (ground state) | Always feel a net force |
| Why unstable | Electrostatically | Radiation from orbiting electrons |

- Both models give the **same size** of atom. In **both**, the positively charged part has most of the mass (NCERT Exercise 12.1).
- A classical atom based on **Rutherford's** model is doomed to collapse.

## Alpha-particle scattering

- Most α-particles go straight through: the atom is mostly **empty space**.
- A few bounce back: there is a tiny, heavy, **positive** nucleus.
- The electrons hardly affect the α-particles because they are so light.

:::trap
The distance of closest approach is **not** the radius of the nucleus. It is only an **upper limit**: for gold, $d \approx 30$ fm with 7.7 MeV α-particles, while the real radius is about 6 fm.
:::

:::trap
$d = \dfrac{2Ze^2}{4\pi\varepsilon_0 K}$ is for a **head-on** approach only. With a non-zero impact parameter the α-particle does not stop; at the closest point it still moves sideways, so it does not get as close.
:::

- Doubling $K$ **halves** $d$. A proton with the same $K$ gets **twice as close** as an α-particle (half the charge).
- With a foil of **solid hydrogen**, α-particles are not turned back: the target (a proton) is lighter than the α-particle (NCERT Exercise 12.2). Large-angle scattering needs a heavy nucleus.

## Energies in an orbit

:::remember
For hydrogen in any Bohr orbit:
- $K = -E$ (positive)
- $U = 2E$ (negative)
- $E = -K = U/2$

Ground state: $K = 13.6$ eV, $U = -27.2$ eV, $E = -13.6$ eV.
:::

:::trap
When an electron moves to a **higher** orbit, its total energy and potential energy **increase** (become less negative), but its kinetic energy and speed **decrease**.
:::

- Negative total energy means the electron is **bound**. $E = 0$ means just free.
- These energies take $U = 0$ at infinity. If a question chooses a different zero for $U$, $E$ and $U$ shift, but $K$ and energy **differences** do not.

## Bohr's postulates

:::trap
Bohr quantised **angular momentum**, $L = nh/2\pi$. He did not quantise linear momentum or the radius directly; the allowed radii follow from $L$.
:::

:::trap
The frequency of the emitted light is **not** the frequency of revolution. It is $\nu = (E_i - E_f)/h$. The two match only for jumps between very large $n$ (from $n$ to $n - 1$).
:::

- The lowest allowed $n$ is 1, not 0. There is no orbit with $L = 0$ in Bohr's model.
- Bohr's model has only **one** quantum number, $n$.

## Levels and transitions

:::remember
- Ground state is $n = 1$. **First** excited state is $n = 2$, **second** excited state is $n = 3$.
- Ionisation energy from the ground state: **13.6 eV**. From $n = 2$: only **3.4 eV**.
- $n = 1 \to 2$ needs 10.2 eV, $1 \to 3$ needs 12.09 eV, $1 \to 4$ needs 12.75 eV.
:::

:::trap
A **photon** is absorbed only if its energy **exactly** matches a gap (or is at least 13.6 eV, which ionises the atom). A **colliding electron** can give away part of its energy. So a 12.5 eV photon does nothing to ground-state hydrogen, but a 12.5 eV electron can lift it to $n = 3$.
:::

- From $n = 3$ the atom can give 3 lines (3→1, 3→2, 2→1). This is the answer to NCERT Exercise 12.8 (12.5 eV electron beam): two Lyman lines and one Balmer line.
- (Exam extra) Many atoms in level $n$ give up to $\dfrac{n(n-1)}{2}$ lines. One atom gives at most $n - 1$ photons.

:::trap
Read "excited to $n = 4$" and "excited to the **fourth excited state**" carefully. The fourth excited state is $n = 5$.
:::

## Hydrogen spectrum (exam extra)

- Lyman: down to $n_f = 1$, **ultraviolet**. Balmer: to $n_f = 2$, the **visible** lines (Hα, red, 656 nm); its limit, 365 nm, is near ultraviolet. Paschen, Brackett, Pfund: to 3, 4, 5, **infrared**.
- In each series, the **longest** wavelength is the smallest jump ($n_f + 1 \to n_f$). The **shortest** (series limit) is the jump from $n = \infty$.
- Series limits in NCERT Fig. 12.5: Lyman 91 nm, Balmer 365 nm, Paschen 820 nm.
- Bigger energy gap means **shorter** wavelength. The largest gap in hydrogen ends on $n = 1$.

:::tip
"**L**ucky **B**oys **P**lay **B**asketball **P**roperly": **L**yman 1, **B**almer 2, **P**aschen 3, **B**rackett 4, **P**fund 5 (the $n_f$ each series ends on). Only Balmer has visible lines.
:::

:::tip
Fast wavelength: $\lambda(\text{nm}) \approx \dfrac{1240}{\Delta E(\text{eV})}$. For 10.2 eV, $\lambda \approx 122$ nm.
:::

## Hydrogen-like ions (exam extra)

- He⁺ ($Z = 2$) and Li²⁺ ($Z = 3$) have one electron, so Bohr's model works. $r \propto n^2/Z$, $v \propto Z/n$, $E \propto Z^2/n^2$.
- He atom (two electrons) is **not** hydrogen-like. Bohr's model fails for it.
- He⁺ in $n = 2$ has the same energy as H in $n = 1$: $-13.6 \times 4/4 = -13.6$ eV.

## de Broglie and limits

- $2\pi r_n = n\lambda$: the $n$-th orbit holds exactly $n$ de Broglie wavelengths.
- Since $\lambda = 2\pi r_n / n \propto n$, the electron's wavelength grows with $n$.

:::remember
NCERT lines to know:
- "Most of an atom is empty space."
- Bohr's model applies only to hydrogenic (one-electron) atoms; it cannot be extended even to helium.
- Bohr's model cannot explain the relative intensities of spectral lines.
- de Broglie: the orbits are circular standing waves.
:::
