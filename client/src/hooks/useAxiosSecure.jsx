import axios from 'axios'
import useAuth from './useAuth'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/Shared/LoadingSpinner'

 const axiosSecure = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
})

const useAxiosSecure = () => {
  const navigate = useNavigate()
  const { logOut,loading } = useAuth()
  useEffect(() => {
    axiosSecure.interceptors.response.use(
      res => {
        return res
      },
      async error => {
        console.log('Error caught from axios interceptor-->', error.response)
        if (error.response.status === 401 || error.response.status === 403) {
          // logout
          logOut()
          if(loading)return <LoadingSpinner/>
          // navigate to login
          navigate('/login')
        }
        return Promise.reject(error)
      }
    )
  }, [logOut, navigate,loading])
  return axiosSecure
}

export default useAxiosSecure
