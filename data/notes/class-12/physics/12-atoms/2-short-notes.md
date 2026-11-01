---
title: "Atoms (Physics): Short Notes"
type: short_notes
chapter: c12.physics.atoms
order: 2
---

## 1. Why we needed a model

- An atom as a whole is **neutral**: it has equal amounts of positive and negative charge. J. J. Thomson (1897) found the negative part, the electron.
- Solids, liquids and dense gases (at any temperature) give a **continuous** spectrum. A **rarefied** gas (neon sign, mercury lamp) gives only certain wavelengths: a **line spectrum**.
- Each element has its own line spectrum. Hydrogen always gives the same set of lines. So the spectrum must come from the structure of the atom.

## 2. Thomson's model (1898)

- Positive charge spread **uniformly** through the whole atom. Electrons sit in it "like seeds in a watermelon": the **plum pudding** model.
- The atom has the same size as in Rutherford's model, but its mass is spread almost evenly.
- It could not explain large-angle scattering of α-particles, and it is unstable electrostatically.

## 3. The Geiger–Marsden experiment (1911)

Done at Rutherford's suggestion.

- **Source:** 5.5 MeV α-particles from $^{214}_{83}\text{Bi}$, made into a narrow beam by lead bricks.
- **Target:** a thin gold foil, $2.1 \times 10^{-7}$ m thick.
- **Detector:** a rotatable zinc sulphide screen and microscope. Each α-particle makes a tiny flash (scintillation).
- The whole set-up is in a **vacuum** chamber.

**What they saw:**

- Most α-particles went straight through, with no deflection or only a very small one.
- Only about **0.14%** were scattered by more than 1°.
- About **1 in 8000** were deflected by more than 90°.

**What it means:** to turn an α-particle back, a very strong repulsion is needed. This happens only if the positive charge and almost all the mass sit in a tiny, dense centre: the **nucleus**.

## 4. Rutherford's nuclear model

- All the positive charge and most of the mass are in a tiny **nucleus**. Electrons revolve around it, like planets around the sun (the **planetary** model).
- Nucleus size: about $10^{-15}$ to $10^{-14}$ m. Atom size: about $10^{-10}$ m, which is 10,000 to 100,000 times bigger.
- So the atom is mostly **empty space**. That is why most α-particles pass through.
- Electrons are too light to deflect α-particles much.

**How the scattering is worked out:**

- The foil is thin, so each α-particle is scattered **only once**.
- Gold is about 50 times heavier than an α-particle, so the nucleus is taken as **fixed**.
- Then Newton's second law and Coulomb's law give the path of the α-particle.

**Impact parameter $b$:** the perpendicular distance of the α-particle's starting line of motion from the centre of the nucleus.

| Impact parameter | Scattering |
| --- | --- |
| Small $b$ (close to nucleus) | Large angle |
| $b = 0$ (head-on) | Bounces straight back, $\theta \approx 180^\circ$ |
| Large $b$ | Nearly undeviated, $\theta \approx 0$ |

Few particles bounce back, so few hit head-on. This means the nucleus is tiny. Rutherford scattering gives an **upper limit** to the size of the nucleus.

:::example{title="Distance of closest approach (NCERT Example 12.2)"}
A 7.7 MeV α-particle moves head-on towards a gold nucleus ($Z = 79$). At closest approach all its kinetic energy has become potential energy:

$$K = \frac{2Ze^2}{4\pi\varepsilon_0 d}$$

This gives $d = 3.84 \times 10^{-16}\,Z$ m $\approx 3.0 \times 10^{-14}$ m $= 30$ fm. The actual gold nucleus is about 6 fm, so the α-particle turns back without touching it.
:::

## 5. Electron orbits in the nuclear model

The electric attraction supplies the centripetal force:
$$\frac{1}{4\pi\varepsilon_0}\,\frac{e^2}{r^2} = \frac{mv^2}{r}$$

- Kinetic energy $K = \dfrac{e^2}{8\pi\varepsilon_0 r}$, potential energy $U = -\dfrac{e^2}{4\pi\varepsilon_0 r}$.
- Total energy $E = -\dfrac{e^2}{8\pi\varepsilon_0 r}$ is **negative**: the electron is **bound**. If $E$ were positive, the electron would not stay in a closed orbit.
- NCERT Example 12.3: from $E = -13.6$ eV, $r = 5.3 \times 10^{-11}$ m and $v = 2.2 \times 10^6$ m/s.

## 6. Two failures of Rutherford's model

1. **Stability.** A revolving electron is accelerating. By classical electromagnetic theory, an accelerating charge radiates energy. So the electron should **spiral into the nucleus**, and the atom should collapse.
2. **Line spectrum.** As the electron spirals in, its frequency of revolution changes smoothly. It would emit a **continuous** spectrum, but atoms give a line spectrum.

Classical physics is not enough at the atomic scale.

## 7. Atomic spectra

- **Emission line spectrum:** bright lines on a dark background. Seen when a gas at low pressure is excited, usually by an electric current. It is a "fingerprint" of the element.
- **Absorption spectrum:** pass white light through the gas. **Dark lines** appear at exactly the wavelengths that the gas emits.
- NCERT Fig. 12.5 shows hydrogen's lines in groups: the **Lyman**, **Balmer** and **Paschen** series.

## 8. Bohr's model of hydrogen (1913)

Bohr mixed classical physics with the new quantum ideas. Three postulates:

1. **Stationary states.** The electron revolves in certain stable orbits **without radiating**. Each such state has a definite total energy.
2. **Quantised angular momentum.** Allowed orbits have $L = \dfrac{nh}{2\pi}$, with $n = 1, 2, 3, \dots$
3. **Transitions.** When the electron jumps from a higher state to a lower one, it emits **one photon** with $h\nu = E_i - E_f$.

**Results for hydrogen:**

- Radius $r_n = n^2 a_0$, where $a_0 = 5.3 \times 10^{-11}$ m (the **Bohr radius**).
- Energy $E_n = -\dfrac{13.6}{n^2}$ eV.
- Speed $v_n = \dfrac{2.2 \times 10^6}{n}$ m/s.

| Quantity | Depends on $n$ as |
| --- | --- |
| Radius $r$ | $n^2$ |
| Speed $v$ | $1/n$ |
| Energy $E$, $K$, $U$ | $1/n^2$ |
| Time period $T$ | $n^3$ |
| Angular momentum $L$ | $n$ |

## 9. Energy levels

- **Ground state** ($n = 1$): lowest energy, $-13.6$ eV, smallest orbit. At room temperature most H atoms are here.
- **Excited states** ($n > 1$): reached by collisions with electrons or atoms, or by absorbing a photon of the right energy.
- **Ionisation energy** of hydrogen: 13.6 eV, the least energy to free the electron from the ground state. Bohr's value agrees with experiment.
- $n = \infty$ has $E = 0$: the electron is free and at rest. Above 0 eV the energy can take **any** value (a continuum).
- As $n$ grows, the levels get **closer together**, and less energy is needed to free the electron.

## 10. Line spectra of hydrogen

- A jump from $n_i$ down to $n_f$ gives a photon with $h\nu = E_{n_i} - E_{n_f}$. Only certain energy gaps exist, so only certain frequencies appear: a **line** spectrum.
- **Absorption:** an atom takes in a photon only if its energy exactly matches a gap. That gives the dark lines.
- **Exam extra:** each series ends on one lower level: Lyman on $n_f = 1$ (ultraviolet), Balmer on $n_f = 2$ (visible lines, limit in the near ultraviolet), Paschen on $n_f = 3$ (infrared), then Brackett ($n_f = 4$) and Pfund ($n_f = 5$). The wavelengths follow the Rydberg formula (see the Formula Sheet).

## 11. de Broglie's explanation of the second postulate

- An electron also behaves as a wave, with $\lambda = h/mv$.
- In a stable orbit, the electron wave must form a **standing wave**: a whole number of wavelengths must fit round the orbit, $2\pi r_n = n\lambda$.
- Put $\lambda = h/mv_n$: you get $mv_n r_n = nh/2\pi$, which is exactly Bohr's condition.
- So quantised orbits come from the **wave nature** of the electron. NCERT Fig. 12.8 shows $n = 4$: four wavelengths round the orbit.

## 12. Limits of Bohr's model

- It works only for **hydrogenic atoms** (one electron: H, He⁺, Li²⁺). It fails even for helium, because it ignores the forces **between electrons**.
- It predicts the frequencies of the lines but **not their relative intensities**.
- Its sharp orbits clash with the uncertainty principle. In quantum mechanics, orbits become regions where the electron is likely to be found.
- It uses only one quantum number, $n$. Quantum mechanics uses four ($n, l, m, s$).
