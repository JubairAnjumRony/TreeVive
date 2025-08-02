import { FaUserCog } from 'react-icons/fa'
import MenuItem from './MenuItem'
import { BsGraphUp } from 'react-icons/bs'

const AdminMenu = () => {
  return (
    <>
      <MenuItem icon={FaUserCog} label='Manage Users' address='manage-users' />
        <MenuItem
                icon={BsGraphUp}
                label='Statistics'
                address='/dashboard'
              />
    </>
  )
}

export default AdminMenu
