import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Writing from './pages/Writing';
import WhatLambdaWasHiding from './pages/posts/WhatLambdaWasHiding';
import UnusedVariable from './pages/posts/UnusedVariable';
import CheckpointInTheMiddleOfAnInsert from './pages/posts/CheckpointInTheMiddleOfAnInsert';
import OpenSource from './pages/OpenSource';
import About from './pages/About';
import RouteMetadata from './components/RouteMetadata';

export function AppRoutes() {
  return (
    <>
      <RouteMetadata />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<About />} />
          <Route path="writing" element={<Writing />} />
          <Route path="writing/a-checkpoint-in-the-middle-of-an-insert" element={<CheckpointInTheMiddleOfAnInsert />} />
          <Route path="writing/what-aws-lambda-was-hiding" element={<WhatLambdaWasHiding />} />
          <Route path="writing/how-a-python-type-checker-decides-a-variable-is-unused" element={<UnusedVariable />} />
          <Route path="open-source" element={<OpenSource />} />
        </Route>
      </Routes>
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
