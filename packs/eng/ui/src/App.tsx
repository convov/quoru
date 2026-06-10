import { createBrowserRouter, RouterProvider } from "react-router-dom"
import { Layout } from "./Layout"
import { ConversationsList } from "./pages/ConversationsList"
import { ConversationDetail } from "./pages/ConversationDetail"
import { EntityDetail } from "./pages/EntityDetail"
import { Team } from "./pages/Team"

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <ConversationsList /> },
      { path: "conversation/:id", element: <ConversationDetail /> },
      { path: "entity/:kind/:id", element: <EntityDetail /> },
      { path: "team", element: <Team /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
