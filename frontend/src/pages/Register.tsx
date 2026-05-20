import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('caregiver');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      const response = await api.post('/auth/register', { name, email, password, role });
      login(response.data.token, response.data.user);
      navigate('/patients');
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(msg || 'Impossibile registrarsi. Controlla i campi e riprova.');
    }
  };

  return (
    <section>
      <h2>Registrazione</h2>
      <form onSubmit={handleSubmit} className="login-form">
        <label>
          Nome completo
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <label>
          Ruolo
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            <option value="caregiver">Caregiver</option>
            <option value="coordinator">Coordinator</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        {error && <p className="error-text">{error}</p>}
        <button type="submit">Registrati</button>
      </form>
    </section>
  );
}

export default Register;
