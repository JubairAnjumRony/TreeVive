// This example shows you how to set up React Stripe.js and use Elements.
// Learn how to accept a payment using the official Stripe docs.
// https://stripe.com/docs/payments/accept-a-payment#web

import  { useEffect, useState } from 'react';

import {

  useStripe,
  useElements,
  CardElement,
} from '@stripe/react-stripe-js';
import './CheckoutForm.css'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import useAxiosSecure from '../../hooks/useAxiosSecure';
import Button from '../Shared/Button/Button';
import PropTypes from 'prop-types';


const CheckoutForm = ({ closeModal, purchaseInfo, refetch, totalQuantity }) =>{
 const navigate = useNavigate()
  const axiosSecure = useAxiosSecure()
  const [clientSecret, setClientSecret] = useState('')
  const [processing, setProcessing] = useState(false)
const stripe = useStripe();
  const elements = useElements();


  useEffect(() => {
    getPaymentIntent()
  }, [purchaseInfo])
  console.log(clientSecret)
  const getPaymentIntent = async () => {
    try {
      const { data } = await axiosSecure.post('/create-payment-intent', {
        quantity: purchaseInfo?.quantity,
        plantId: purchaseInfo?.plantId,
      })
      setClientSecret(data.clientSecret)
    } catch (err) {
      console.log(err)
    }
  }
  

 

  const handleSubmit = async (event) => {
      setProcessing(true)
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

   // Get a reference to a mounted CardElement. Elements knows how
    // to find your CardElement because there can only ever be one of
    // each type of element.
    const card = elements.getElement(CardElement)

    if (card == null) {
      setProcessing(false)
      return
    }

    // Use your card Element with other Stripe.js APIs
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card,
    })
    if (error) {
      setProcessing(false)
      return console.log('[error]', error)
    } else {
      console.log('[PaymentMethod]', paymentMethod)
    }
   
      // confirm payment
    const { paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: card,
        billing_details: {
          name: purchaseInfo?.customer?.name,
          email: purchaseInfo?.customer?.email,
        },
      },
    })
    


    //  if payment succeed then  ---------------------------------------------------
    if (paymentIntent.status === 'succeeded') {
     try{
      await axiosSecure.post('/order',{
        ...purchaseInfo,
        transactionId: paymentIntent?.id,
      })
      //decrease quantify from plant collection
      await axiosSecure.patch(`/plants/quantify/${purchaseInfo?.plantId}`,{
        quantifyToUpdate: totalQuantity,
        status:'decrease',
      })
      toast.success('order successful')
      refetch()
      navigate('/dashboard/my-orders')
    }
    catch(err){
      console.log(err)
    
    }
    finally{
    setProcessing(false)
     closeModal()
    }
    }
  }
  return (
    <form onSubmit={handleSubmit}>
       <CardElement
        options={{
          style: {
            base: {
              fontSize: '16px',
              color: '#424770',
              '::placeholder': {
                color: '#aab7c4',
              },
            },
            invalid: {
              color: '#9e2146',
            },
          },
        }}
      />

        <div className="=flex justify-around mt-2 gap-2">
                  <Button
                  disabled = {!stripe || !clientSecret || processing}
                  type='submit'
                  label={`pay ${purchaseInfo?.price}$`}
                 ></Button>
                        <Button outline={true} onClick={closeModal} label={'Cancel'} />
                </div>

      {/* Show error message to your customers */}
      {/* {errorMessage && <div>{errorMessage}</div>} */}
    </form>
  );
};

// const stripePromise = loadStripe('pk_test_6pRNASCoBOKtIshFeQd4XMUh');

// const options = {
//   mode: 'payment',
//   amount: 1099,
//   currency: 'usd',
//   // Fully customizable with appearance API.
//   appearance: {
//     /*...*/
//   },
// }


CheckoutForm.propTypes = {
  closeModal: PropTypes.func.isRequired,
  purchaseInfo: PropTypes.object,
  refetch: PropTypes.func.isRequired,
  totalQuantity: PropTypes.number,
}

export default CheckoutForm;